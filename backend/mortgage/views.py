from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.emails import notify
from accounts.permissions import IsAdminRole, IsManager

from .models import MortgageApplication, MortgageProgram
from .serializers import (
    CalculatorSerializer,
    ManagerMortgageUpdateSerializer,
    MortgageApplicationSerializer,
    MortgageProgramSerializer,
)


class ProgramViewSet(viewsets.ModelViewSet):
    serializer_class = MortgageProgramSerializer
    pagination_class = None

    def get_queryset(self):
        qs = MortgageProgram.objects.all()
        u = self.request.user
        if not (u.is_authenticated and u.is_admin_role):
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return []
        return [IsAdminRole()]


class CalculatorView(APIView):
    """POST /api/mortgage/calculate/ — расчёт аннуитетного платежа."""

    def post(self, request):
        s = CalculatorSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(s.calculate())


class MyApplicationViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = MortgageApplicationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return MortgageApplication.objects.filter(user=self.request.user).select_related("program", "apartment__building__complex")

    def perform_create(self, serializer):
        app = serializer.save(user=self.request.user)
        notify(self.request.user, "Заявка на ипотеку принята",
               f"Заявка №{app.pk} в {app.program.bank_name} принята. Ипотечный брокер свяжется с вами.")

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        app = self.get_object()
        if app.status not in (MortgageApplication.Status.NEW, MortgageApplication.Status.IN_REVIEW):
            return Response({"detail": "Заявку нельзя отозвать."}, status=400)
        app.status = MortgageApplication.Status.CANCELLED
        app.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(app).data)


class ManagerApplicationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsManager]
    queryset = MortgageApplication.objects.select_related("program", "apartment__building__complex", "user")
    filterset_fields = ("status", "program")
    search_fields = ("full_name", "phone", "user__email")

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return ManagerMortgageUpdateSerializer
        return MortgageApplicationSerializer

    def perform_update(self, serializer):
        app = serializer.save(manager=self.request.user)
        notify(app.user, "Статус заявки на ипотеку изменён",
               f"Заявка №{app.pk}: {app.get_status_display()}.\n{app.manager_comment}")

    def update(self, request, *args, **kwargs):
        super().update(request, *args, **kwargs)
        return Response(MortgageApplicationSerializer(self.get_object(), context={"request": request}).data)
