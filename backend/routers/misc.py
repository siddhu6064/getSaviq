import asyncio
import csv
import io
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse

from database import db
from deps import get_accessible_profile, get_current_user
from models import Category, ExpenseCreate, PaymentMethod, UserSettingsUpdate
from routers.expenses import create_expense

settings_router = APIRouter(prefix="/settings", tags=["settings"])
export_router = APIRouter(prefix="/export", tags=["export"])
import_router = APIRouter(prefix="/import", tags=["import"])


def _safe_filename_part(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]", "_", value or "")
    return cleaned or "profile"


# ===================== SETTINGS =====================

@settings_router.get("")
async def get_user_settings(current_user: dict = Depends(get_current_user)):
    """Get user settings"""
    settings = await db.user_settings.find_one(
        {"user_id": current_user["user_id"]},
        {"_id": 0},
    )
    if not settings:
        return {"user_id": current_user["user_id"], "dark_mode": False, "currency": "USD"}
    return settings


@settings_router.put("")
async def update_user_settings(
    settings_data: UserSettingsUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update user settings"""
    update_data = settings_data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc)

    await db.user_settings.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": update_data},
        upsert=True,
    )

    settings = await db.user_settings.find_one(
        {"user_id": current_user["user_id"]},
        {"_id": 0},
    )
    return settings


# ===================== EXPORT =====================

@export_router.get("/csv")
async def export_csv(
    profile_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Export transactions as CSV"""
    query = {"user_id": current_user["user_id"], "profile_id": profile_id}

    if start_date or end_date:
        query["date"] = {}
        try:
            if start_date:
                query["date"]["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            if end_date:
                query["date"]["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date filter format")
        if "$gte" in query["date"] and "$lte" in query["date"] and query["date"]["$lte"] < query["date"]["$gte"]:
            raise HTTPException(status_code=400, detail="end_date cannot be earlier than start_date")

    expenses, cats_raw, pms_raw = await asyncio.gather(
        db.expenses.find(query, {"_id": 0}).sort("date", -1).to_list(10000),
        db.categories.find({"user_id": current_user["user_id"]}, {"_id": 0}).to_list(200),
        db.payment_methods.find({"user_id": current_user["user_id"]}, {"_id": 0}).to_list(100),
    )
    categories = {c["category_id"]: c["name"] for c in cats_raw}
    payment_methods = {p["payment_id"]: p["name"] for p in pms_raw}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Description", "Amount", "Category", "Payment Method", "Merchant", "Notes"])

    for exp in expenses:
        date_str = (
            exp["date"].strftime("%Y-%m-%d")
            if isinstance(exp["date"], datetime)
            else str(exp["date"])[:10]
        )
        writer.writerow([
            date_str,
            exp.get("type", "expense"),
            exp.get("description", ""),
            exp.get("amount", 0),
            categories.get(exp.get("category_id"), ""),
            payment_methods.get(exp.get("payment_method_id"), ""),
            exp.get("merchant", ""),
            exp.get("notes", ""),
        ])

    return PlainTextResponse(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=expenses_{_safe_filename_part(profile_id)}.csv"},
    )


@export_router.get("/json")
async def export_json(
    profile_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Export transactions as JSON for PDF generation on the frontend"""
    query = {"user_id": current_user["user_id"], "profile_id": profile_id}

    if start_date or end_date:
        query["date"] = {}
        try:
            if start_date:
                query["date"]["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            if end_date:
                query["date"]["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date filter format")
        if "$gte" in query["date"] and "$lte" in query["date"] and query["date"]["$lte"] < query["date"]["$gte"]:
            raise HTTPException(status_code=400, detail="end_date cannot be earlier than start_date")

    expenses, cats_raw, pms_raw = await asyncio.gather(
        db.expenses.find(query, {"_id": 0}).sort("date", -1).to_list(10000),
        db.categories.find({"user_id": current_user["user_id"]}, {"_id": 0}).to_list(200),
        db.payment_methods.find({"user_id": current_user["user_id"]}, {"_id": 0}).to_list(100),
    )
    categories = {c["category_id"]: c for c in cats_raw}
    payment_methods = {p["payment_id"]: p for p in pms_raw}

    total_income   = sum(e["amount"] for e in expenses if e.get("type") == "income")
    total_expense  = sum(e["amount"] for e in expenses if e.get("type") == "expense")
    total_transfer = sum(e["amount"] for e in expenses if e.get("type") == "transfer")

    category_totals: dict = {}
    for exp in expenses:
        if exp.get("type") == "expense":
            cat_name = categories.get(exp.get("category_id"), {}).get("name", "Uncategorized")
            category_totals[cat_name] = category_totals.get(cat_name, 0) + exp["amount"]

    formatted_expenses = []
    for exp in expenses:
        formatted_exp = {**exp}
        if isinstance(exp.get("date"), datetime):
            formatted_exp["date"] = exp["date"].isoformat()
        formatted_exp["category_name"] = categories.get(exp.get("category_id"), {}).get("name", "")
        formatted_exp["payment_method_name"] = payment_methods.get(exp.get("payment_method_id"), {}).get("name", "")
        formatted_expenses.append(formatted_exp)

    return {
        "expenses": formatted_expenses,
        "summary": {
            "total_income":       round(total_income, 2),
            "total_expense":      round(total_expense, 2),
            "total_transfer":     round(total_transfer, 2),
            "balance":            round(total_income - total_expense, 2),
            "transaction_count":  len(expenses),
        },
        "category_breakdown": [
            {"name": k, "amount": round(v, 2)}
            for k, v in sorted(category_totals.items(), key=lambda x: -x[1])
        ],
        "period": {
            "start": start_date or (expenses[-1]["date"].isoformat() if expenses else None),
            "end":   end_date   or (expenses[0]["date"].isoformat()  if expenses else None),
        },
    }


# ===================== IMPORT =====================

VALID_TYPES = {"expense", "income", "transfer"}
MAX_IMPORT_ROWS = 5000
MAX_REPORTED_ERRORS = 25


@import_router.post("/csv")
async def import_csv(
    profile_id: str,
    file: UploadFile,
    current_user: dict = Depends(get_current_user),
):
    """
    Import transactions from a CSV matching the /export/csv column format:
    Date, Type, Description, Amount, Category, Payment Method, Merchant, Notes.
    Category/Payment Method are matched by name (case-insensitive) and created
    automatically if they don't already exist — same as a user typing a new one
    while adding an expense manually.
    """
    await get_accessible_profile(profile_id, current_user)
    user_id = current_user["user_id"]

    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded CSV")

    reader = csv.DictReader(io.StringIO(text))
    required_columns = {"Date", "Type", "Description", "Amount"}
    if not reader.fieldnames or not required_columns.issubset(set(reader.fieldnames)):
        raise HTTPException(
            status_code=400,
            detail="CSV must have columns: Date, Type, Description, Amount, "
            "Category, Payment Method, Merchant, Notes",
        )

    rows = list(reader)
    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(status_code=400, detail=f"CSV has more than {MAX_IMPORT_ROWS} rows")

    # Preload existing categories/payment methods so lookups are in-memory.
    existing_categories, existing_payment_methods = await asyncio.gather(
        db.categories.find({"user_id": user_id}, {"_id": 0}).to_list(500),
        db.payment_methods.find({"user_id": user_id}, {"_id": 0}).to_list(200),
    )
    category_by_name: dict[str, str] = {
        (c["name"] or "").strip().lower(): c["category_id"]
        for c in existing_categories
        if c.get("profile_id") in (None, profile_id)
    }
    payment_by_name: dict[str, str] = {
        (p["name"] or "").strip().lower(): p["payment_id"] for p in existing_payment_methods
    }
    default_payment_id = next(
        (p["payment_id"] for p in existing_payment_methods if p.get("is_default")),
        (existing_payment_methods[0]["payment_id"] if existing_payment_methods else None),
    )

    async def resolve_category(name: str) -> Optional[str]:
        name = (name or "").strip()
        if not name:
            return None
        key = name.lower()
        if key in category_by_name:
            return category_by_name[key]
        category = Category(user_id=user_id, profile_id=profile_id, name=name)
        doc = category.model_dump()
        doc["name_normalized"] = key
        await db.categories.insert_one(doc)
        category_by_name[key] = category.category_id
        return category.category_id

    async def resolve_payment_method(name: str) -> Optional[str]:
        nonlocal default_payment_id
        name = (name or "").strip()
        if not name:
            return default_payment_id
        key = name.lower()
        if key in payment_by_name:
            return payment_by_name[key]
        payment = PaymentMethod(user_id=user_id, name=name, type="other")
        doc = payment.model_dump()
        doc["name_normalized"] = key
        await db.payment_methods.insert_one(doc)
        payment_by_name[key] = payment.payment_id
        if default_payment_id is None:
            default_payment_id = payment.payment_id
        return payment.payment_id

    imported = 0
    skipped = 0
    errors: list[str] = []

    for i, row in enumerate(rows, start=2):  # row 1 is the header
        try:
            date_str = (row.get("Date") or "").strip()
            type_str = (row.get("Type") or "expense").strip().lower()
            description = (row.get("Description") or "").strip() or "Imported transaction"
            amount_str = (row.get("Amount") or "").strip()

            if not date_str or not amount_str:
                raise ValueError("missing Date or Amount")
            if type_str not in VALID_TYPES:
                raise ValueError(f"invalid Type '{type_str}'")

            amount = abs(float(amount_str))
            if amount <= 0:
                raise ValueError("Amount must be greater than 0")

            date = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            category_id = await resolve_category(row.get("Category"))
            payment_method_id = await resolve_payment_method(row.get("Payment Method"))
            if not payment_method_id:
                raise ValueError("no Payment Method column and no existing payment method to default to")

            data = ExpenseCreate(
                profile_id=profile_id,
                type=type_str,
                amount=amount,
                category_id=category_id,
                payment_method_id=payment_method_id,
                description=description,
                merchant=(row.get("Merchant") or "").strip() or None,
                date=date,
                notes=(row.get("Notes") or "").strip() or None,
            )
            await create_expense(data, current_user)
            imported += 1
        except Exception as e:
            skipped += 1
            if len(errors) < MAX_REPORTED_ERRORS:
                errors.append(f"Row {i}: {e}")

    return {"imported": imported, "skipped": skipped, "errors": errors}
