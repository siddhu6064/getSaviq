import re
from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator
import uuid
from datetime import datetime, timezone


# ===================== DOMAIN MODELS =====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    auth_provider: str = "google"  # "google" or "apple"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserSession(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Profile(BaseModel):
    profile_id: str = Field(default_factory=lambda: f"profile_{uuid.uuid4().hex[:12]}")
    user_id: str
    name: str
    profile_type: Literal["personal", "business", "shared"] = "personal"
    is_default: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ===================== PROFILE MEMBER MODELS =====================

class ProfileMemberRole(str, Enum):
    owner = "owner"
    member = "member"


class ProfileMemberStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"


class ProfileMember(BaseModel):
    member_id: str = Field(default_factory=lambda: f"pmem_{uuid.uuid4().hex[:12]}")
    profile_id: str
    user_id: str  # profile owner
    invited_user_id: Optional[str] = None  # set once invitee registers/is found
    invited_email: str
    role: ProfileMemberRole = ProfileMemberRole.member
    status: ProfileMemberStatus = ProfileMemberStatus.pending
    invite_token: str = Field(default_factory=lambda: uuid.uuid4().hex)
    invited_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    accepted_at: Optional[datetime] = None


class Category(BaseModel):
    category_id: str = Field(default_factory=lambda: f"cat_{uuid.uuid4().hex[:12]}")
    user_id: str
    profile_id: Optional[str] = None  # None means available for all profiles
    name: str
    icon: str = "tag"
    color: str = "#6366f1"
    is_default: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PaymentMethod(BaseModel):
    payment_id: str = Field(default_factory=lambda: f"pm_{uuid.uuid4().hex[:12]}")
    user_id: str
    name: str
    type: str  # "cash", "credit_card", "debit_card", "bank_transfer", "other"
    last_four: Optional[str] = None  # Last 4 digits for cards
    is_default: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Expense(BaseModel):
    expense_id: str = Field(default_factory=lambda: f"exp_{uuid.uuid4().hex[:12]}")
    user_id: str
    profile_id: str
    type: str = "expense"  # "expense", "income", "transfer"
    amount: float
    category_id: Optional[str] = None
    payment_method_id: str
    to_payment_method_id: Optional[str] = None  # For transfers
    description: str
    merchant: Optional[str] = None
    date: datetime
    time: Optional[str] = None  # HH:MM format
    receipt_image: Optional[str] = None  # Base64 encoded image
    notes: Optional[str] = None
    attachments: List[str] = Field(default_factory=list)  # R2 public URLs
    is_pending: bool = False
    # Recurring transaction fields
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None
    recurring_start_date: Optional[datetime] = None
    recurring_end_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Budget(BaseModel):
    budget_id: str = Field(default_factory=lambda: f"budget_{uuid.uuid4().hex[:12]}")
    user_id: str
    profile_id: str
    category_id: Optional[str] = None  # None means total budget for the profile
    amount: float
    period: str = "monthly"  # "weekly", "monthly", "yearly"
    start_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SavingsGoal(BaseModel):
    goal_id: str = Field(default_factory=lambda: f"goal_{uuid.uuid4().hex[:12]}")
    user_id: str
    profile_id: str
    title: str
    target_amount: float = Field(gt=0)
    current_amount: float = Field(ge=0)
    deadline: datetime
    category: str
    status: Literal["active", "paused", "completed", "cancelled"] = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserSettings(BaseModel):
    user_id: str
    dark_mode: bool = False
    currency: str = "USD"
    # Push notification preferences
    push_budget_alerts: bool = True
    push_goal_milestones: bool = True
    push_large_transactions: bool = True
    weekly_digest_push: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ===================== REQUEST / RESPONSE SCHEMAS =====================

class AuthResponse(BaseModel):
    user: User
    session_token: str

    class Config:
        arbitrary_types_allowed = True


class MessageResponse(BaseModel):
    message: str


class ApiRootResponse(BaseModel):
    message: str
    version: str


class StatusResponse(BaseModel):
    status: str


class BudgetProgressItem(Budget):
    spent: float
    remaining: float
    percentage: float
    is_over_budget: bool


class BudgetProgressResponse(BaseModel):
    budgets: List[BudgetProgressItem]
    total_budget: Optional[BudgetProgressItem] = None


class AnalyticsSummaryResponse(BaseModel):
    total_spend: float
    total_income: float
    net_balance: float
    current_month_spend: float
    previous_month_spend: float
    month_over_month_change_pct: float


class CategoryBreakdownItem(BaseModel):
    category_id: str
    category_name: str
    amount: float
    percentage: float


class CategoryBreakdownResponse(BaseModel):
    items: List[CategoryBreakdownItem]


class PaymentMethodBreakdownItem(BaseModel):
    payment_method_id: str
    payment_method_name: str
    amount: float


class PaymentMethodBreakdownResponse(BaseModel):
    items: List[PaymentMethodBreakdownItem]


class MonthlyTrendItem(BaseModel):
    month: str
    amount: float


class MonthlyTrendResponse(BaseModel):
    items: List[MonthlyTrendItem]


class InsightItem(BaseModel):
    type: str
    severity: Literal["info", "warning", "positive"]
    title: str
    message: str
    metric: Optional[dict] = None


class InsightListResponse(BaseModel):
    insights: List[InsightItem]


class EmailRegisterRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=72)
    name: str = Field(max_length=100)


class EmailLoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=72)


class ProfileCreate(BaseModel):
    name: str = Field(max_length=100)
    profile_type: Literal["personal", "business", "shared"] = "personal"


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    profile_type: Optional[Literal["personal", "business", "shared"]] = None
    is_default: Optional[bool] = None


class ProfileMemberCreate(BaseModel):
    email: str = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value):
            raise ValueError("Invalid email address")
        return value


class ProfileMemberResponse(BaseModel):
    member_id: str
    profile_id: str
    invited_email: str
    role: ProfileMemberRole
    status: ProfileMemberStatus
    invited_at: datetime
    accepted_at: Optional[datetime] = None
    # invite_token intentionally excluded


class ProfileMemberInfo(BaseModel):
    """Lightweight member info embedded in profile list responses."""
    member_id: str
    invited_email: str
    role: ProfileMemberRole
    status: ProfileMemberStatus


class ProfileWithMembers(Profile):
    """Profile enriched with member list and caller's role."""
    caller_role: ProfileMemberRole = ProfileMemberRole.owner
    members: List[ProfileMemberInfo] = Field(default_factory=list)


class CategoryCreate(BaseModel):
    name: str = Field(max_length=100)
    icon: str = "tag"
    color: str = "#6366f1"
    profile_id: Optional[str] = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str) -> str:
        if not re.match(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", value):
            raise ValueError("Color must be a valid hex string")
        return value


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    icon: Optional[str] = None
    color: Optional[str] = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not re.match(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", value):
            raise ValueError("Color must be a valid hex string")
        return value


class PaymentMethodCreate(BaseModel):
    name: str = Field(max_length=100)
    type: str
    last_four: Optional[str] = None
    is_default: bool = False

    @field_validator("last_four")
    @classmethod
    def validate_last_four(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not re.match(r"^\d{4}$", value):
            raise ValueError("last_four must be exactly 4 digits")
        return value


class PaymentMethodUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    type: Optional[str] = None
    last_four: Optional[str] = None
    is_default: Optional[bool] = None

    @field_validator("last_four")
    @classmethod
    def validate_last_four(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not re.match(r"^\d{4}$", value):
            raise ValueError("last_four must be exactly 4 digits")
        return value


class ExpenseCreate(BaseModel):
    profile_id: str
    type: Literal["expense", "income", "transfer"] = "expense"
    amount: float = Field(gt=0)
    category_id: Optional[str] = None
    payment_method_id: str
    to_payment_method_id: Optional[str] = None
    description: str = Field(max_length=500)
    merchant: Optional[str] = Field(None, max_length=200)
    date: datetime
    time: Optional[str] = None
    receipt_image: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=500)
    attachments: List[str] = Field(default_factory=list)
    is_pending: bool = False
    # Recurring transaction fields
    is_recurring: bool = False
    recurring_frequency: Optional[Literal["daily", "weekly", "monthly", "yearly"]] = None
    recurring_start_date: Optional[datetime] = None
    recurring_end_date: Optional[datetime] = None

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Description cannot be blank")
        return value.strip()

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and len(value) > 500:
            raise ValueError("Notes must be 500 characters or fewer")
        return value

    @field_validator("time")
    @classmethod
    def validate_time(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not re.match(r"^(?:[01]\d|2[0-3]):[0-5]\d$", value):
            raise ValueError("Time must be in HH:MM format")
        return value

    @model_validator(mode="after")
    def validate_transfer_and_recurring(self):
        if self.type == "transfer":
            if not self.to_payment_method_id:
                raise ValueError("to_payment_method_id is required for transfer type")
            if self.to_payment_method_id == self.payment_method_id:
                raise ValueError("to_payment_method_id must not equal payment_method_id")

        if (
            self.recurring_start_date
            and self.recurring_end_date
            and self.recurring_end_date < self.recurring_start_date
        ):
            raise ValueError("recurring_end_date cannot be before recurring_start_date")
        return self


class ExpenseUpdate(BaseModel):
    type: Optional[Literal["expense", "income", "transfer"]] = None
    amount: Optional[float] = None
    category_id: Optional[str] = None
    payment_method_id: Optional[str] = None
    to_payment_method_id: Optional[str] = None
    description: Optional[str] = Field(None, max_length=500)
    merchant: Optional[str] = Field(None, max_length=200)
    date: Optional[datetime] = None
    time: Optional[str] = None
    receipt_image: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=500)
    attachments: Optional[List[str]] = None
    is_pending: Optional[bool] = None
    # Recurring transaction fields
    is_recurring: Optional[bool] = None
    recurring_frequency: Optional[Literal["daily", "weekly", "monthly", "yearly"]] = None
    recurring_start_date: Optional[datetime] = None
    recurring_end_date: Optional[datetime] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value <= 0:
            raise ValueError("Amount must be greater than 0")
        return value

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not value.strip():
            raise ValueError("Description cannot be blank")
        return value.strip()

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and len(value) > 500:
            raise ValueError("Notes must be 500 characters or fewer")
        return value

    @field_validator("time")
    @classmethod
    def validate_time(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not re.match(r"^(?:[01]\d|2[0-3]):[0-5]\d$", value):
            raise ValueError("Time must be in HH:MM format")
        return value

    @model_validator(mode="after")
    def validate_transfer_and_recurring(self):
        if self.type == "transfer":
            if not self.to_payment_method_id:
                raise ValueError("to_payment_method_id is required for transfer type")
            if self.payment_method_id and self.to_payment_method_id == self.payment_method_id:
                raise ValueError("to_payment_method_id must not equal payment_method_id")

        if (
            self.recurring_start_date
            and self.recurring_end_date
            and self.recurring_end_date < self.recurring_start_date
        ):
            raise ValueError("recurring_end_date cannot be before recurring_start_date")
        return self


class BudgetCreate(BaseModel):
    profile_id: str
    category_id: Optional[str] = None
    amount: float = Field(gt=0)
    period: Literal["weekly", "monthly", "yearly"] = "monthly"


class BudgetUpdate(BaseModel):
    amount: Optional[float] = None
    period: Optional[Literal["weekly", "monthly", "yearly"]] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value <= 0:
            raise ValueError("Amount must be greater than 0")
        return value


class SavingsGoalCreate(BaseModel):
    profile_id: str
    title: str = Field(max_length=100)
    target_amount: float = Field(gt=0)
    current_amount: float = Field(ge=0)
    deadline: datetime
    category: str
    status: Literal["active", "paused", "completed", "cancelled"] = "active"

    @field_validator("title", "category")
    @classmethod
    def validate_non_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Field cannot be blank")
        return value.strip()

    @field_validator("deadline")
    @classmethod
    def validate_deadline_not_past(cls, value: datetime) -> datetime:
        compare_value = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if compare_value < datetime.now(timezone.utc):
            raise ValueError("deadline cannot be in the past")
        return value


class SavingsGoalUpdate(BaseModel):
    profile_id: Optional[str] = None
    title: Optional[str] = Field(None, max_length=100)
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    deadline: Optional[datetime] = None
    category: Optional[str] = None
    status: Optional[Literal["active", "paused", "completed", "cancelled"]] = None

    @field_validator("title", "category")
    @classmethod
    def validate_optional_non_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not value.strip():
            raise ValueError("Field cannot be blank")
        return value.strip()

    @field_validator("target_amount")
    @classmethod
    def validate_target_amount(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value <= 0:
            raise ValueError("target_amount must be greater than 0")
        return value

    @field_validator("current_amount")
    @classmethod
    def validate_current_amount(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value < 0:
            raise ValueError("current_amount cannot be negative")
        return value

    @field_validator("deadline")
    @classmethod
    def validate_optional_deadline_not_past(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is None:
            return value
        compare_value = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if compare_value < datetime.now(timezone.utc):
            raise ValueError("deadline cannot be in the past")
        return value


class SavingsGoalProjection(BaseModel):
    basis: Literal["historical_velocity", "manual_assumption", "already_completed", "unavailable"]
    monthly_contribution_assumed: float
    months_remaining: Optional[float] = None
    projected_completion_date: Optional[datetime] = None


class SavingsGoalResponse(SavingsGoal):
    progress_percentage: float = 0.0
    monthly_savings_recommendation: Optional[float] = None
    projected_completion: SavingsGoalProjection


class UserSettingsUpdate(BaseModel):
    dark_mode: Optional[bool] = None
    currency: Optional[str] = Field(None, max_length=10)
    push_budget_alerts: Optional[bool] = None
    push_goal_milestones: Optional[bool] = None
    push_large_transactions: Optional[bool] = None
    weekly_digest_push: Optional[bool] = None


class ScanReceiptRequest(BaseModel):
    image: str = Field(max_length=5_000_000)  # Base64 encoded image


class ChatInsightsRequest(BaseModel):
    profile_id: str
    recent_days: int = Field(default=30, ge=7, le=90)
    question: str = Field(default="How can I save more?", min_length=3, max_length=300)


class ChatInsightsResponse(BaseModel):
    profile_id: str
    generated_at: datetime
    context: dict
    prompt_template: dict
    recommendation: dict


# ===================== NET WORTH MODELS =====================

class AssetType(str, Enum):
    cash = "cash"
    property = "property"
    investment = "investment"
    other = "other"


class LiabilityType(str, Enum):
    loan = "loan"
    credit = "credit"
    mortgage = "mortgage"
    other = "other"


class Asset(BaseModel):
    asset_id: str = Field(default_factory=lambda: f"asset_{uuid.uuid4().hex[:12]}")
    user_id: str
    profile_id: str
    name: str
    type: AssetType
    value: float
    currency: str = "USD"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AssetCreate(BaseModel):
    profile_id: str
    name: str = Field(max_length=100)
    type: AssetType
    value: float = Field(ge=0)
    currency: str = Field(default="USD", max_length=10)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("name cannot be blank")
        return value.strip()


class AssetUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    type: Optional[AssetType] = None
    value: Optional[float] = None
    currency: Optional[str] = Field(None, max_length=10)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not value.strip():
            raise ValueError("name cannot be blank")
        return value.strip()

    @field_validator("value")
    @classmethod
    def validate_value(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value < 0:
            raise ValueError("value cannot be negative")
        return value


class AssetResponse(Asset):
    pass


class Liability(BaseModel):
    liability_id: str = Field(default_factory=lambda: f"liab_{uuid.uuid4().hex[:12]}")
    user_id: str
    profile_id: str
    name: str
    type: LiabilityType
    balance: float
    interest_rate: Optional[float] = None
    monthly_payment: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LiabilityCreate(BaseModel):
    profile_id: str
    name: str = Field(max_length=100)
    type: LiabilityType
    balance: float = Field(ge=0)
    interest_rate: Optional[float] = None
    monthly_payment: Optional[float] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("name cannot be blank")
        return value.strip()


class LiabilityUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    type: Optional[LiabilityType] = None
    balance: Optional[float] = None
    interest_rate: Optional[float] = None
    monthly_payment: Optional[float] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not value.strip():
            raise ValueError("name cannot be blank")
        return value.strip()

    @field_validator("balance")
    @classmethod
    def validate_balance(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value < 0:
            raise ValueError("balance cannot be negative")
        return value


class LiabilityResponse(Liability):
    pass


class NetWorthSnapshot(BaseModel):
    snapshot_id: str = Field(default_factory=lambda: f"snap_{uuid.uuid4().hex[:12]}")
    user_id: str
    profile_id: str
    date: datetime
    net_worth: float
    assets_total: float
    liabilities_total: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NetWorthProfileBreakdown(BaseModel):
    profile_id: str
    assets_total: float
    liabilities_total: float
    net_worth: float


class NetWorthResponse(BaseModel):
    assets_total: float
    liabilities_total: float
    net_worth: float
    by_profile: List[NetWorthProfileBreakdown]


# ===================== PUSH NOTIFICATIONS =====================

class DeviceType(str, Enum):
    ios = "ios"
    android = "android"


class PushToken(BaseModel):
    token_id: str = Field(default_factory=lambda: f"tok_{uuid.uuid4().hex[:12]}")
    user_id: str
    expo_push_token: str
    device_type: DeviceType
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_active: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PushTokenCreate(BaseModel):
    expo_push_token: str = Field(max_length=100)
    device_type: DeviceType

    @field_validator("expo_push_token")
    @classmethod
    def validate_token(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("expo_push_token cannot be blank")
        return value


class Notification(BaseModel):
    notif_id: str = Field(default_factory=lambda: f"notif_{uuid.uuid4().hex[:12]}")
    user_id: str
    type: str
    title: str
    body: str
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    link: Optional[str] = None


class NotificationResponse(Notification):
    pass


# ===================== BILL MODELS =====================

class BillFrequency(str, Enum):
    monthly = "monthly"
    weekly = "weekly"
    annual = "annual"


class BillStatus(str, Enum):
    active = "active"
    paused = "paused"


class Bill(BaseModel):
    bill_id: str = Field(default_factory=lambda: f"bill_{uuid.uuid4().hex[:12]}")
    user_id: str
    profile_id: str
    name: str
    merchant: Optional[str] = None
    expected_amount: float
    frequency: BillFrequency
    due_day: int  # 1–31
    auto_detected: bool = False
    linked_expense_ids: List[str] = Field(default_factory=list)
    status: BillStatus = BillStatus.active
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BillCreate(BaseModel):
    profile_id: str
    name: str = Field(max_length=100)
    merchant: Optional[str] = Field(None, max_length=200)
    expected_amount: float = Field(gt=0)
    frequency: BillFrequency
    due_day: int
    auto_detected: bool = False
    linked_expense_ids: List[str] = Field(default_factory=list)
    status: BillStatus = BillStatus.active

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("name cannot be blank")
        return value.strip()

    @field_validator("due_day")
    @classmethod
    def validate_due_day(cls, value: int) -> int:
        if not (1 <= value <= 31):
            raise ValueError("due_day must be between 1 and 31")
        return value


class BillUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    merchant: Optional[str] = Field(None, max_length=200)
    expected_amount: Optional[float] = None
    frequency: Optional[BillFrequency] = None
    due_day: Optional[int] = None
    status: Optional[BillStatus] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not value.strip():
            raise ValueError("name cannot be blank")
        return value.strip()

    @field_validator("expected_amount")
    @classmethod
    def validate_amount(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value <= 0:
            raise ValueError("expected_amount must be greater than 0")
        return value

    @field_validator("due_day")
    @classmethod
    def validate_due_day(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and not (1 <= value <= 31):
            raise ValueError("due_day must be between 1 and 31")
        return value


class BillResponse(Bill):
    pass


class BillFromSubscriptionCreate(BaseModel):
    """Lightweight create for promoting a detected subscription to a bill."""
    profile_id: str
    name: str = Field(max_length=100)
    merchant: str = Field(max_length=200)
    expected_amount: float = Field(gt=0)
    frequency: BillFrequency
    due_day: int

    @field_validator("name", "merchant")
    @classmethod
    def validate_non_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Field cannot be blank")
        return value.strip()

    @field_validator("due_day")
    @classmethod
    def validate_due_day(cls, value: int) -> int:
        if not (1 <= value <= 31):
            raise ValueError("due_day must be between 1 and 31")
        return value
