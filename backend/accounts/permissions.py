from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsClient(BasePermission):
    """Любой авторизованный пользователь с подтверждённым email."""

    message = "Требуется авторизация."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class IsManager(BasePermission):
    """Менеджер или администратор."""

    message = "Доступно только менеджерам."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_manager)


class IsAdminRole(BasePermission):
    """Только администратор."""

    message = "Доступно только администраторам."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_admin_role)


class IsManagerOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        u = request.user
        return bool(u and u.is_authenticated and u.is_manager)
