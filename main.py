import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import anthropic

load_dotenv()

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


class CalculateRequest(BaseModel):
    home_price: float = 1_600_000
    down_payment: float = 250_000
    interest_rate: float = 6.0
    sp500_return: float = 11.8
    house_appreciation: float = 5.4
    annual_maintenance: float = 15_000
    monthly_rent: float = 5_000
    annual_rent_increase: float = 5.0
    property_tax_rate: float = 1.25


class ChatRequest(BaseModel):
    message: str
    sliders: dict


def calculate_projection(params: CalculateRequest) -> dict:
    loan = params.home_price - params.down_payment
    monthly_rate = params.interest_rate / 100 / 12
    n_payments = 360  # 30 years

    # Monthly mortgage payment
    if monthly_rate > 0:
        monthly_payment = loan * (monthly_rate * (1 + monthly_rate) ** n_payments) / (
            (1 + monthly_rate) ** n_payments - 1
        )
    else:
        monthly_payment = loan / n_payments

    # Track remaining balance
    balance = loan
    years = []

    cumulative_mortgage = 0
    cumulative_maintenance = 0
    cumulative_rent = 0
    cumulative_property_tax = 0
    cumulative_mortgage = 0
    cumulative_maintenance = 0
    cumulative_rent = 0
    assessed_value = params.home_price

    for year in range(1, 31):
        monthly_rate = params.interest_rate / 100 / 12
        annual_mortgage_payment = 0
        interest_paid_year = 0
        principal_paid_year = 0

        for _ in range(12):
            if balance > 0:
                interest = balance * monthly_rate
                principal = monthly_payment - interest
                if principal > balance:
                    principal = balance
                balance -= principal
                interest_paid_year += interest
                principal_paid_year += principal
                annual_mortgage_payment += monthly_payment

        # 6 factors:
        # (+) Appreciation: cumulative home value gain
        home_value = params.home_price * (1 + params.house_appreciation / 100) ** year
        appreciation = home_value - params.home_price

        # (+) Rent Savings: cumulative rent you didn't pay
        annual_rent = params.monthly_rent * 12 * (1 + params.annual_rent_increase / 100) ** (year - 1)
        cumulative_rent += annual_rent

        # (-) Mortgage Payments: cumulative payments made
        cumulative_mortgage += annual_mortgage_payment

        # (-) Opportunity Cost: what down payment would be worth in S&P minus the down payment itself
        opportunity_cost = params.down_payment * (1 + params.sp500_return / 100) ** year - params.down_payment

        # (-) Property Tax: assessed value capped at 2% annual increase, can't exceed market value
        assessed_value = min(assessed_value * 1.02, home_value)
        property_tax = assessed_value * params.property_tax_rate / 100
        cumulative_property_tax += property_tax

        # (-) Maintenance: cumulative maintenance
        maintenance = params.annual_maintenance
        cumulative_maintenance += maintenance

        # Net = Appreciation + Rent Savings - Mortgage - Opportunity Cost - Property Tax - Maintenance
        net_value = (appreciation + cumulative_rent
                     - cumulative_mortgage - opportunity_cost
                     - cumulative_property_tax - cumulative_maintenance)

        years.append({
            "year": year,
            "home_value": round(home_value),
            "appreciation": round(appreciation),
            "cumulative_rent": round(cumulative_rent),
            "annual_rent": round(annual_rent),
            "cumulative_mortgage": round(cumulative_mortgage),
            "annual_mortgage": round(annual_mortgage_payment),
            "opportunity_cost": round(opportunity_cost),
            "cumulative_property_tax": round(cumulative_property_tax),
            "property_tax": round(property_tax),
            "cumulative_maintenance": round(cumulative_maintenance),
            "maintenance": round(maintenance),
            "net_value": round(net_value),
            "remaining_balance": round(max(balance, 0)),
            "interest_paid": round(interest_paid_year),
            "principal_paid": round(principal_paid_year),
        })

    return {
        "monthly_payment": round(monthly_payment),
        "years": years,
    }


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.post("/api/calculate")
async def calculate(params: CalculateRequest):
    return calculate_projection(params)


@app.post("/api/chat")
async def chat(req: ChatRequest):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key or api_key == "your-key-here":
        return {"error": "Please set ANTHROPIC_API_KEY in .env"}

    client = anthropic.Anthropic(api_key=api_key)

    system_prompt = f"""You are a helpful financial advisor assistant embedded in a Buy vs Rent housing calculator app.
The user is currently looking at the following scenario:

{json.dumps(req.sliders, indent=2)}

Help them understand the financial implications. Be concise and use specific numbers from their scenario.
Format currency values with commas and dollar signs. Use markdown for formatting.
Do NOT use markdown tables. Use bullet lists instead when comparing values."""

    def generate():
        with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": req.message}],
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
