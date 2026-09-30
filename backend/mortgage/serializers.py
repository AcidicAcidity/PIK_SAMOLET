from decimal import Decimal

from rest_framework import serializers

from catalog.serializers import ApartmentListSerializer

from .models import MortgageApplication, MortgageProgram, annuity


class MortgageProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = MortgageProgram
        fields = (
            "id", "bank_name", "name", "rate", "min_down_payment_percent", "max_term_years",
            "max_amount", "description", "badge", "color", "is_active",
        )


def validate_terms(attrs, program):
    price = attrs["property_price"]
    down = attrs["down_payment"]
    term = attrs["term_years"]
    errors = {}
    if down >= price:
        errors["down_payment"] = "Первоначальный взнос должен быть меньше стоимости."
    elif program:
        min_down = price * program.min_down_payment_percent / 100
        if down < min_down:
            errors["down_payment"] = f"Минимальный взнос по программе — {program.min_down_payment_percent}% ({min_down:,.0f} ₽).".replace(",", " ")
        if price - down > program.max_amount:
            errors["property_price"] = f"Максимальная сумма кредита по программе — {program.max_amount:,.0f} ₽.".replace(",", " ")
        if term > program.max_term_years:
            errors["term_years"] = f"Максимальный срок по программе — {program.max_term_years} лет."
    if errors:
        raise serializers.ValidationError(errors)


class CalculatorSerializer(serializers.Serializer):
    property_price = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("100000"))
    down_payment = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"))
    term_years = serializers.IntegerField(min_value=1, max_value=35)
    program = serializers.PrimaryKeyRelatedField(queryset=MortgageProgram.objects.filter(is_active=True), required=False, allow_null=True)
    rate = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, min_value=Decimal("0"), max_value=Decimal("50"))

    def validate(self, attrs):
        program = attrs.get("program")
        if not program and attrs.get("rate") is None:
            raise serializers.ValidationError("Укажите программу или ставку.")
        validate_terms(attrs, program)
        return attrs

    def calculate(self):
        d = self.validated_data
        rate = d["program"].rate if d.get("program") else d["rate"]
        loan = d["property_price"] - d["down_payment"]
        return {"loan_amount": loan, "rate": rate, "term_years": d["term_years"], **annuity(loan, rate, d["term_years"])}


class MortgageApplicationSerializer(serializers.ModelSerializer):
    program_info = MortgageProgramSerializer(source="program", read_only=True)
    apartment_info = ApartmentListSerializer(source="apartment", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    employment_display = serializers.CharField(source="get_employment_display", read_only=True)
    client_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = MortgageApplication
        fields = (
            "id", "program", "program_info", "apartment", "apartment_info", "property_price", "down_payment",
            "term_years", "rate", "loan_amount", "monthly_payment", "monthly_income", "employment",
            "employment_display", "full_name", "phone", "birth_date", "comment", "status", "status_display",
            "manager_comment", "client_email", "created_at", "updated_at",
        )
        read_only_fields = ("rate", "loan_amount", "monthly_payment", "status", "manager_comment")

    def validate(self, attrs):
        program = attrs["program"]
        if not program.is_active:
            raise serializers.ValidationError({"program": "Программа недоступна."})
        validate_terms(attrs, program)
        calc = annuity(attrs["property_price"] - attrs["down_payment"], program.rate, attrs["term_years"])
        attrs["rate"] = program.rate
        attrs["loan_amount"] = attrs["property_price"] - attrs["down_payment"]
        attrs["monthly_payment"] = calc["monthly_payment"]
        return attrs


class ManagerMortgageUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MortgageApplication
        fields = ("status", "manager_comment")
