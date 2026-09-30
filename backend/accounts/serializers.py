from django.contrib.auth import password_validation
from rest_framework import serializers

from .models import LoyaltyLevel, User


class LoyaltyLevelSerializer(serializers.ModelSerializer):
    perks_list = serializers.SerializerMethodField()

    class Meta:
        model = LoyaltyLevel
        fields = ("id", "name", "min_purchases_amount", "discount_percent", "color", "perks", "perks_list")

    def get_perks_list(self, obj):
        return [p.strip() for p in obj.perks.splitlines() if p.strip()]


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    loyalty_level = LoyaltyLevelSerializer(read_only=True)
    discount_percent = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name", "middle_name", "phone",
            "role", "role_display", "email_verified", "date_joined",
            "loyalty_level", "discount_percent",
        )
        read_only_fields = ("id", "email", "role", "email_verified", "date_joined")


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email=value, email_verified=True).exists():
            raise serializers.ValidationError("Пользователь с таким email уже зарегистрирован.")
        return value

    def validate(self, attrs):
        password_validation.validate_password(attrs["password"], User(email=attrs["email"], first_name=attrs["first_name"]))
        return attrs


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class VerifySerializer(serializers.Serializer):
    challenge_id = serializers.UUIDField()
    code = serializers.RegexField(r"^\s*\d{6}\s*$", error_messages={"invalid": "Код должен состоять из 6 цифр."})


class ChallengeSerializer(serializers.Serializer):
    challenge_id = serializers.UUIDField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(VerifySerializer):
    new_password = serializers.CharField(min_length=8, write_only=True)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Неверный текущий пароль.")
        return value

    def validate_new_password(self, value):
        password_validation.validate_password(value, self.context["request"].user)
        return value


class AdminUserSerializer(serializers.ModelSerializer):
    """Для администратора: управление ролями, блокировкой и уровнем лояльности."""

    role_display = serializers.CharField(source="get_role_display", read_only=True)
    loyalty_level = LoyaltyLevelSerializer(read_only=True)
    purchases_total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    loyalty_level_override = serializers.PrimaryKeyRelatedField(
        queryset=LoyaltyLevel.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name", "phone", "role", "role_display",
            "is_active", "email_verified", "date_joined", "last_login",
            "loyalty_level", "loyalty_level_override", "purchases_total",
        )
        read_only_fields = ("id", "email", "email_verified", "date_joined", "last_login")

    def validate(self, attrs):
        request = self.context["request"]
        if self.instance and self.instance.pk == request.user.pk:
            if attrs.get("role", self.instance.role) != User.Role.ADMIN or attrs.get("is_active") is False:
                raise serializers.ValidationError("Нельзя понизить роль или заблокировать самого себя.")
        return attrs
