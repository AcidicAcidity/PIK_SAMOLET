import uuid

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.utils import timezone
from rest_framework import generics, mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .emails import send_code
from .models import EmailCode, LoyaltyLevel, User
from .permissions import IsAdminRole
from .serializers import (
    AdminUserSerializer,
    ChallengeSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    LoyaltyLevelSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
    VerifySerializer,
)


def mask_email(email: str) -> str:
    name, _, domain = email.partition("@")
    visible = name[:2] if len(name) > 2 else name[:1]
    return f"{visible}{'*' * max(len(name) - len(visible), 1)}@{domain}"


def challenge_response(user, purpose, http_status=status.HTTP_200_OK):
    obj, code = EmailCode.issue(user, purpose)
    send_code(user, purpose, code)
    return Response(
        {
            "challenge_id": str(obj.id),
            "purpose": purpose,
            "email": mask_email(user.email),
            "expires_in": settings.TWO_FACTOR["CODE_TTL_MINUTES"] * 60,
            "resend_in": settings.TWO_FACTOR["RESEND_INTERVAL_SECONDS"],
        },
        status=http_status,
    )


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


class AuthThrottleMixin:
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


def _consume_code(challenge_id, code, purposes):
    """Проверяет код. Возвращает (EmailCode, None) или (None, текст ошибки)."""
    try:
        obj = EmailCode.objects.select_related("user").get(id=challenge_id, purpose__in=purposes)
    except EmailCode.DoesNotExist:
        return None, "Код не найден. Запросите новый."
    if obj.used:
        return None, "Код уже использован. Запросите новый."
    if obj.is_expired:
        return None, "Срок действия кода истёк. Запросите новый."
    if obj.attempts >= settings.TWO_FACTOR["MAX_ATTEMPTS"]:
        return None, "Превышено число попыток. Запросите новый код."
    if not obj.check_code(code):
        obj.attempts += 1
        obj.save(update_fields=["attempts"])
        left = settings.TWO_FACTOR["MAX_ATTEMPTS"] - obj.attempts
        return None, f"Неверный код. Осталось попыток: {left}."
    obj.used = True
    obj.save(update_fields=["used"])
    return obj, None


class RegisterView(AuthThrottleMixin, APIView):
    """Шаг 1 регистрации: создаём пользователя и отправляем код на email."""

    def post(self, request):
        s = RegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        with transaction.atomic():
            user = User.objects.filter(email=d["email"]).first()
            if user is None:
                user = User(email=d["email"])
            user.first_name = d["first_name"]
            user.last_name = d.get("last_name", "")
            user.phone = d.get("phone", "")
            user.set_password(d["password"])
            user.save()
        return challenge_response(user, EmailCode.Purpose.REGISTER, status.HTTP_201_CREATED)


class LoginView(AuthThrottleMixin, APIView):
    """Шаг 1 входа: проверка пароля, отправка одноразового кода на email (2FA)."""

    def post(self, request):
        s = LoginSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = authenticate(request, email=s.validated_data["email"].lower(), password=s.validated_data["password"])
        if user is None:
            return Response({"detail": "Неверный email или пароль."}, status=status.HTTP_400_BAD_REQUEST)
        purpose = EmailCode.Purpose.LOGIN if user.email_verified else EmailCode.Purpose.REGISTER
        return challenge_response(user, purpose)


class VerifyView(AuthThrottleMixin, APIView):
    """Шаг 2: проверка кода из письма, выдача JWT."""

    def post(self, request):
        s = VerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        obj, error = _consume_code(
            s.validated_data["challenge_id"], s.validated_data["code"],
            [EmailCode.Purpose.LOGIN, EmailCode.Purpose.REGISTER],
        )
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)
        user = obj.user
        if not user.is_active:
            return Response({"detail": "Учётная запись заблокирована."}, status=status.HTTP_403_FORBIDDEN)
        user.email_verified = True
        user.last_login = timezone.now()
        user.save(update_fields=["email_verified", "last_login"])
        return Response({**tokens_for(user), "user": UserSerializer(user).data})


class ResendCodeView(AuthThrottleMixin, APIView):
    def post(self, request):
        s = ChallengeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        obj = EmailCode.objects.select_related("user").filter(id=s.validated_data["challenge_id"]).first()
        if obj is None:
            return Response({"detail": "Сессия подтверждения не найдена. Начните заново."}, status=400)
        wait = settings.TWO_FACTOR["RESEND_INTERVAL_SECONDS"] - (timezone.now() - obj.created_at).total_seconds()
        if wait > 0:
            return Response(
                {"detail": f"Повторная отправка будет доступна через {int(wait) + 1} с.", "resend_in": int(wait) + 1},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        return challenge_response(obj.user, obj.purpose)


class PasswordResetRequestView(AuthThrottleMixin, APIView):
    def post(self, request):
        s = PasswordResetRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = User.objects.filter(email=s.validated_data["email"].lower(), is_active=True).first()
        if user:
            return challenge_response(user, EmailCode.Purpose.RESET)
        # Не раскрываем, существует ли пользователь
        return Response({
            "challenge_id": str(uuid.uuid4()), "purpose": "reset",
            "email": mask_email(s.validated_data["email"]),
            "expires_in": settings.TWO_FACTOR["CODE_TTL_MINUTES"] * 60,
            "resend_in": settings.TWO_FACTOR["RESEND_INTERVAL_SECONDS"],
        })


class PasswordResetConfirmView(AuthThrottleMixin, APIView):
    def post(self, request):
        s = PasswordResetConfirmSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        obj, error = _consume_code(s.validated_data["challenge_id"], s.validated_data["code"], [EmailCode.Purpose.RESET])
        if error:
            return Response({"detail": error}, status=400)
        from django.contrib.auth import password_validation
        from django.core.exceptions import ValidationError

        try:
            password_validation.validate_password(s.validated_data["new_password"], obj.user)
        except ValidationError as e:
            return Response({"new_password": list(e.messages)}, status=400)
        obj.user.set_password(s.validated_data["new_password"])
        obj.user.email_verified = True
        obj.user.save()
        return Response({"detail": "Пароль изменён. Теперь вы можете войти."})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            RefreshToken(request.data.get("refresh", "")).blacklist()
        except TokenError:
            pass
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        s = ChangePasswordSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        request.user.set_password(s.validated_data["new_password"])
        request.user.save()
        return Response({"detail": "Пароль изменён."})


class LoyaltyStatusView(APIView):
    """Текущий уровень клиента и прогресс до следующего."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        level = user.loyalty_level
        total = user.purchases_total
        nxt = level.next_level() if level else LoyaltyLevel.objects.order_by("min_purchases_amount").first()
        progress = 100
        if nxt:
            base = level.min_purchases_amount if level else 0
            span = nxt.min_purchases_amount - base
            progress = int(min(100, max(0, (total - base) / span * 100))) if span else 100
        return Response({
            "level": LoyaltyLevelSerializer(level).data if level else None,
            "next_level": LoyaltyLevelSerializer(nxt).data if nxt else None,
            "purchases_total": total,
            "to_next_level": (nxt.min_purchases_amount - total) if nxt else 0,
            "progress_percent": progress,
            "is_manual": bool(user.loyalty_level_override_id),
            "levels": LoyaltyLevelSerializer(LoyaltyLevel.objects.all(), many=True).data,
        })


class LoyaltyLevelViewSet(viewsets.ModelViewSet):
    """Список уровней — публичный, изменение — только администратор."""

    queryset = LoyaltyLevel.objects.all()
    serializer_class = LoyaltyLevelSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return []
        return [IsAdminRole()]


class AdminUserViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    queryset = User.objects.select_related("loyalty_level_override").all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminRole]
    filterset_fields = ("role", "is_active")
    search_fields = ("email", "first_name", "last_name", "phone")
    ordering_fields = ("date_joined", "email")
