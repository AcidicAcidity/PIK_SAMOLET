import logging

from django.conf import settings
from django.core.mail import send_mail

from .models import EmailCode

logger = logging.getLogger(__name__)

SUBJECTS = {
    EmailCode.Purpose.LOGIN: "Код для входа — Новый Горизонт",
    EmailCode.Purpose.REGISTER: "Подтверждение регистрации — Новый Горизонт",
    EmailCode.Purpose.RESET: "Восстановление пароля — Новый Горизонт",
}

ACTIONS = {
    EmailCode.Purpose.LOGIN: "входа в личный кабинет",
    EmailCode.Purpose.REGISTER: "подтверждения регистрации",
    EmailCode.Purpose.RESET: "восстановления пароля",
}


def send_code(user, purpose, code):
    ttl = settings.TWO_FACTOR["CODE_TTL_MINUTES"]
    action = ACTIONS[purpose]
    name = user.first_name or "клиент"
    text = (
        f"Здравствуйте, {name}!\n\n"
        f"Ваш код для {action}: {code}\n"
        f"Код действует {ttl} минут.\n\n"
        "Если вы не запрашивали код — просто проигнорируйте это письмо и смените пароль.\n\n"
        "— Команда «Новый Горизонт»"
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="color:#0f2a44;margin-top:0">Новый Горизонт</h2>
      <p>Здравствуйте, {name}!</p>
      <p>Ваш код для {action}:</p>
      <div style="font-size:32px;letter-spacing:8px;font-weight:bold;background:#f3f6fa;padding:16px;text-align:center;border-radius:8px;color:#0f2a44">{code}</div>
      <p style="color:#6b7280;font-size:13px">Код действует {ttl} минут. Если вы не запрашивали код — проигнорируйте это письмо.</p>
    </div>"""
    send_mail(SUBJECTS[purpose], text, settings.DEFAULT_FROM_EMAIL, [user.email], html_message=html)
    if settings.DEBUG:
        logger.info("[2FA] %s code for %s: %s", purpose, user.email, code)


def notify(user, subject, text):
    """Простое уведомление пользователю (смена статуса брони/заявки). Ошибки почты не ломают API."""
    try:
        send_mail(subject, text, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=True)
    except Exception:  # pragma: no cover
        logger.exception("Не удалось отправить уведомление")
