import re
from decimal import Decimal

from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import EmailCode, LoyaltyLevel, User
from bookings.models import Booking
from catalog.models import Apartment, Building, ResidentialComplex
from mortgage.models import MortgageProgram, annuity


def code_from_mail():
    return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)


@override_settings(REST_FRAMEWORK={
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "core.pagination.StandardPagination",
    "DEFAULT_THROTTLE_RATES": {"auth": "1000/min"},
})
class BaseCase(APITestCase):
    def setUp(self):
        cache.clear()
        LoyaltyLevel.objects.create(name="Старт", min_purchases_amount=0, discount_percent=Decimal("1"))
        LoyaltyLevel.objects.create(name="Золото", min_purchases_amount=10_000_000, discount_percent=Decimal("3.5"))
        cx = ResidentialComplex.objects.create(name="Тест", slug="test", address="ул. 1")
        self.building = Building.objects.create(complex=cx, number="1", floors=10)
        self.apt = Apartment.objects.create(building=self.building, number="1", floor=3, rooms=2, area=Decimal("55"),
                                            price=Decimal("10000000"))
        self.apt2 = Apartment.objects.create(building=self.building, number="2", floor=5, rooms=0, area=Decimal("25"),
                                             price=Decimal("5000000"))
        self.client_user = User.objects.create_user("c@test.ru", "StrongPass123!", email_verified=True, first_name="Ivan")
        self.manager = User.objects.create_user("m@test.ru", "StrongPass123!", email_verified=True, role=User.Role.MANAGER)
        self.admin = User.objects.create_user("a@test.ru", "StrongPass123!", email_verified=True, role=User.Role.ADMIN)

    def login(self, email, password="StrongPass123!"):
        r = self.client.post("/api/auth/login/", {"email": email, "password": password}, format="json")
        assert r.status_code == 200, r.data
        r = self.client.post("/api/auth/verify/", {"challenge_id": r.data["challenge_id"], "code": code_from_mail()}, format="json")
        assert r.status_code == 200, r.data
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        return r.data


class TwoFactorTests(BaseCase):
    def test_register_requires_email_code(self):
        r = self.client.post("/api/auth/register/", {"email": "new@test.ru", "password": "VeryStrong123!", "first_name": "Петр"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["purpose"], "register")
        self.assertFalse(User.objects.get(email="new@test.ru").email_verified)
        r = self.client.post("/api/auth/verify/", {"challenge_id": r.data["challenge_id"], "code": code_from_mail()}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)
        self.assertTrue(User.objects.get(email="new@test.ru").email_verified)

    def test_login_password_only_gives_no_token(self):
        r = self.client.post("/api/auth/login/", {"email": "c@test.ru", "password": "StrongPass123!"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("access", r.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_wrong_password(self):
        r = self.client.post("/api/auth/login/", {"email": "c@test.ru", "password": "bad"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_wrong_code_and_attempt_limit(self):
        r = self.client.post("/api/auth/login/", {"email": "c@test.ru", "password": "StrongPass123!"}, format="json")
        cid = r.data["challenge_id"]
        real = code_from_mail()
        wrong = "000000" if real != "000000" else "111111"
        for _ in range(5):
            r = self.client.post("/api/auth/verify/", {"challenge_id": cid, "code": wrong}, format="json")
            self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/auth/verify/", {"challenge_id": cid, "code": real}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("попыток", r.data["detail"])

    def test_code_single_use(self):
        r = self.client.post("/api/auth/login/", {"email": "c@test.ru", "password": "StrongPass123!"}, format="json")
        cid, code = r.data["challenge_id"], code_from_mail()
        self.assertEqual(self.client.post("/api/auth/verify/", {"challenge_id": cid, "code": code}, format="json").status_code, 200)
        self.assertEqual(self.client.post("/api/auth/verify/", {"challenge_id": cid, "code": code}, format="json").status_code, 400)

    def test_codes_are_stored_hashed(self):
        self.client.post("/api/auth/login/", {"email": "c@test.ru", "password": "StrongPass123!"}, format="json")
        code = code_from_mail()
        self.assertNotEqual(EmailCode.objects.first().code_hash, code)

    def test_resend_throttled(self):
        r = self.client.post("/api/auth/login/", {"email": "c@test.ru", "password": "StrongPass123!"}, format="json")
        r = self.client.post("/api/auth/resend/", {"challenge_id": r.data["challenge_id"]}, format="json")
        self.assertEqual(r.status_code, 429)

    def test_password_reset(self):
        r = self.client.post("/api/auth/password-reset/", {"email": "c@test.ru"}, format="json")
        r = self.client.post("/api/auth/password-reset/confirm/",
                             {"challenge_id": r.data["challenge_id"], "code": code_from_mail(), "new_password": "BrandNew456!"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.login("c@test.ru", "BrandNew456!")


class RoleTests(BaseCase):
    def test_client_cannot_access_manager_api(self):
        self.login("c@test.ru")
        self.assertEqual(self.client.get("/api/manager/bookings/").status_code, 403)
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 403)
        self.assertEqual(self.client.patch(f"/api/apartments/{self.apt.id}/", {"price": 1}, format="json").status_code, 403)

    def test_manager_can_edit_but_not_admin_users(self):
        self.login("m@test.ru")
        self.assertEqual(self.client.get("/api/manager/stats/").status_code, 200)
        r = self.client.patch(f"/api/apartments/{self.apt.id}/", {"price": "9900000"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 403)

    def test_admin_changes_role(self):
        self.login("a@test.ru")
        r = self.client.patch(f"/api/admin/users/{self.client_user.id}/", {"role": "manager"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.client_user.refresh_from_db()
        self.assertEqual(self.client_user.role, "manager")

    def test_anonymous_catalog_is_public(self):
        r = self.client.get("/api/apartments/?rooms=0,2&price_max=20000000&ordering=-price")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 2)
        self.assertEqual(r.data["results"][0]["discount_percent"], 0)
        r = self.client.get(f"/api/apartments/{self.apt.id}/")
        self.assertEqual(r.data["rooms_label"], "2-комнатная")


class BookingLoyaltyTests(BaseCase):
    def test_full_booking_lifecycle_and_loyalty(self):
        self.login("c@test.ru")
        r = self.client.get(f"/api/apartments/{self.apt.id}/")
        self.assertEqual(Decimal(r.data["discounted_price"]), Decimal("9900000"))  # 1% уровня «Старт»

        r = self.client.post("/api/bookings/", {"apartment": self.apt.id, "payment_method": "cash"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        bid = r.data["id"]
        self.apt.refresh_from_db()
        self.assertEqual(self.apt.status, "reserved")

        # повторная бронь той же квартиры невозможна
        r = self.client.post("/api/bookings/", {"apartment": self.apt.id}, format="json")
        self.assertEqual(r.status_code, 400)

        self.login("m@test.ru")
        self.assertEqual(self.client.post(f"/api/manager/bookings/{bid}/complete/").status_code, 400)  # сначала confirm
        self.assertEqual(self.client.post(f"/api/manager/bookings/{bid}/confirm/", {"comment": "ok"}).status_code, 200)
        self.assertEqual(self.client.post(f"/api/manager/bookings/{bid}/complete/").status_code, 200)
        self.apt.refresh_from_db()
        self.assertEqual(self.apt.status, "sold")

        self.client_user.refresh_from_db()
        self.assertEqual(self.client_user.loyalty_level.name, "Старт")  # 9.9 млн < 10 млн
        self.login("c@test.ru")
        r = self.client.get("/api/loyalty/me/")
        self.assertEqual(r.data["next_level"]["name"], "Золото")
        self.assertEqual(r.data["progress_percent"], 99)

    def test_cancel_returns_apartment(self):
        self.login("c@test.ru")
        bid = self.client.post("/api/bookings/", {"apartment": self.apt2.id}, format="json").data["id"]
        r = self.client.post(f"/api/bookings/{bid}/cancel/")
        self.assertEqual(r.data["status"], "cancelled")
        self.apt2.refresh_from_db()
        self.assertEqual(self.apt2.status, "available")

    def test_favorites_and_compare(self):
        self.login("c@test.ru")
        self.client.post(f"/api/apartments/{self.apt.id}/favorite/")
        self.assertEqual(len(self.client.get("/api/favorites/").data), 1)
        self.assertTrue(self.client.get(f"/api/apartments/{self.apt.id}/").data["is_favorite"])
        r = self.client.get(f"/api/compare/?ids={self.apt.id},{self.apt2.id}")
        self.assertEqual(len(r.data), 2)


class MortgageTests(BaseCase):
    def setUp(self):
        super().setUp()
        self.program = MortgageProgram.objects.create(bank_name="Банк", name="Семейная", rate=Decimal("6"),
                                                      min_down_payment_percent=20, max_term_years=30, max_amount=12_000_000)

    def test_annuity_formula(self):
        # 1 000 000 под 12% на 1 год — известный платёж 88 849 ₽
        self.assertEqual(annuity(Decimal("1000000"), Decimal("12"), 1)["monthly_payment"], Decimal("88849"))

    def test_calculator_endpoint_and_validation(self):
        r = self.client.post("/api/mortgage/calculate/", {"property_price": 10_000_000, "down_payment": 1_000_000,
                                                          "term_years": 20, "program": self.program.id}, format="json")
        self.assertEqual(r.status_code, 400)  # взнос < 20%
        r = self.client.post("/api/mortgage/calculate/", {"property_price": 10_000_000, "down_payment": 2_000_000,
                                                          "term_years": 20, "program": self.program.id}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["schedule"]), 20)

    def test_application_flow(self):
        self.login("c@test.ru")
        r = self.client.post("/api/mortgage/applications/", {
            "program": self.program.id, "apartment": self.apt.id, "property_price": 10_000_000, "down_payment": 3_000_000,
            "term_years": 25, "monthly_income": 200000, "full_name": "Иванов Иван", "phone": "+79000000000",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["status"], "new")
        app_id = r.data["id"]
        self.login("m@test.ru")
        r = self.client.patch(f"/api/manager/mortgage/{app_id}/", {"status": "approved", "manager_comment": "Одобрено"}, format="json")
        self.assertEqual(r.data["status_display"], "Одобрена")
