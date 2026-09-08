import logging
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from config import get_settings

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
logger = logging.getLogger(__name__)
_client = None
settings = get_settings()

def get_client():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGO_URL)
    return _client

def get_db():
    return get_client()[settings.DB_NAME]

db = get_db()

async def create_indexes():
    await db.expenses.create_index([("user_id", 1), ("profile_id", 1), ("date", -1)])
    await db.expenses.create_index([("user_id", 1), ("profile_id", 1), ("type", 1), ("date", -1)])
    await db.expenses.create_index([("expense_id", 1)], unique=True)
    await db.expenses.create_index([("user_id", 1), ("category_id", 1)])
    await db.expenses.create_index([("user_id", 1), ("payment_method_id", 1)])

    await db.user_sessions.create_index([("session_token", 1)], unique=True)
    await db.user_sessions.create_index([("user_id", 1)])
    await db.user_sessions.create_index([("expires_at", 1)], expireAfterSeconds=0)

    # Sparse alone doesn't exempt "" (only a genuinely missing field) — Apple
    # Sign-In users who hide their email get email="", and a second such user
    # would collide on a plain sparse unique index. A partial filter that also
    # requires a non-empty string fixes that while still enforcing uniqueness
    # for every user who does have a real email.
    try:
        await db.users.drop_index("email_1")
    except Exception:
        pass
    await db.users.create_index(
        [("email", 1)],
        unique=True,
        partialFilterExpression={"email": {"$type": "string", "$gt": ""}},
    )
    await db.users.create_index([("user_id", 1)], unique=True)

    await db.profiles.create_index([("user_id", 1)])
    await db.profiles.create_index([("profile_id", 1)], unique=True)
    await db.profiles.create_index([("user_id", 1), ("profile_id", 1)])
    await db.profiles.create_index(
        [("user_id", 1), ("name_normalized", 1)],
        unique=True,
        partialFilterExpression={"name_normalized": {"$type": "string"}},
    )

    await db.categories.create_index([("user_id", 1)])
    await db.categories.create_index([("category_id", 1)], unique=True)
    await db.categories.create_index([("user_id", 1), ("category_id", 1)])
    await db.categories.create_index(
        [("user_id", 1), ("profile_id", 1), ("name_normalized", 1)],
        unique=True,
        partialFilterExpression={"name_normalized": {"$type": "string"}},
    )

    await db.payment_methods.create_index([("user_id", 1)])
    await db.payment_methods.create_index([("payment_id", 1)], unique=True)
    await db.payment_methods.create_index([("user_id", 1), ("payment_id", 1)])
    await db.payment_methods.create_index(
        [("user_id", 1), ("name_normalized", 1), ("type", 1), ("last_four", 1)],
        unique=True,
        partialFilterExpression={"name_normalized": {"$type": "string"}},
    )

    await db.budgets.create_index([("user_id", 1), ("profile_id", 1)])
    await db.budgets.create_index([("budget_id", 1)], unique=True)
    await db.budgets.create_index(
        [("user_id", 1), ("profile_id", 1), ("category_id", 1)],
        unique=True,
    )

    await db.savings_goals.create_index([("goal_id", 1)], unique=True)
    await db.savings_goals.create_index([("user_id", 1), ("profile_id", 1), ("status", 1)])
    await db.savings_goals.create_index([("user_id", 1), ("profile_id", 1), ("deadline", 1)])

    await db.weekly_digests.create_index([("user_id", 1), ("profile_id", 1), ("week_start", 1), ("week_end", 1)], unique=True)
    await db.weekly_digests.create_index([("user_id", 1), ("profile_id", 1), ("updated_at", -1)])

    # Net worth indexes
    await db.assets.create_index([("asset_id", 1)], unique=True)
    await db.assets.create_index([("user_id", 1), ("profile_id", 1)])

    await db.liabilities.create_index([("liability_id", 1)], unique=True)
    await db.liabilities.create_index([("user_id", 1), ("profile_id", 1)])

    await db.net_worth_snapshots.create_index([("snapshot_id", 1)], unique=True)
    await db.net_worth_snapshots.create_index([("user_id", 1), ("date", -1)])
    await db.net_worth_snapshots.create_index(
        [("user_id", 1), ("profile_id", 1), ("date", 1)], unique=True
    )

    # Push notifications indexes
    await db.push_tokens.create_index(
        [("user_id", 1), ("expo_push_token", 1)], unique=True
    )
    await db.push_tokens.create_index([("token_id", 1)], unique=True)

    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    await db.notifications.create_index([("notif_id", 1)], unique=True)

    # Profile members indexes
    await db.profile_members.create_index([("member_id", 1)], unique=True)
    await db.profile_members.create_index([("invite_token", 1)], unique=True)
    await db.profile_members.create_index([("profile_id", 1)])
    await db.profile_members.create_index([("invited_email", 1), ("status", 1)])
    await db.profile_members.create_index([("invited_user_id", 1), ("status", 1)], sparse=True)

    # Bills indexes
    await db.bills.create_index([("bill_id", 1)], unique=True)
    await db.bills.create_index([("user_id", 1), ("profile_id", 1)])
    await db.bills.create_index([("user_id", 1), ("status", 1)])
    await db.bills.create_index([("user_id", 1), ("due_day", 1)])

    logger.info("MongoDB indexes ensured")

async def close_db():
    if _client:
        _client.close()
