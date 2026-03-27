# Buy vs Rent Wealth Calculator

A single-page financial modeling app that compares the long-term wealth impact of buying a home vs. renting and investing the difference. Built with FastAPI, Plotly.js, and Claude AI.

## How It Works

The calculator tracks 6 factors over 30 years to determine whether buying or renting builds more wealth:

| Factor | Direction | Description |
|---|---|---|
| Appreciation | (+) Buy | Cumulative home value gain above purchase price |
| Rent Savings | (+) Buy | Cumulative rent avoided by owning |
| Mortgage Payments | (-) Buy | Cumulative principal + interest paid |
| Opportunity Cost | (-) Buy | Growth of down payment if invested in S&P 500 instead |
| Property Tax | (-) Buy | Cumulative taxes (assessed value capped at 2%/yr increase, Prop 13) |
| Maintenance | (-) Buy | Cumulative repair/upkeep costs |

**Net Value** = Appreciation + Rent Savings - Mortgage - Opportunity Cost - Property Tax - Maintenance

Positive = buying wins. Negative = renting wins.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Add your Anthropic API key to `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Run

```bash
source .venv/bin/activate
uvicorn main:app --reload
```

Open [http://localhost:8000](http://localhost:8000).

## Features

- **Interactive sliders** for all assumptions (home price, rates, rent, etc.)
- **Snapshot table** comparing factors at years 1, 5, 10, 15, 20, and 30
- **Plotly charts** with cumulative factor breakdown and yearly net value views
- **Claude AI chat** sidebar for context-aware financial analysis
- **Draggable metric definitions** panel

## Default Assumptions

| Variable | Default |
|---|---|
| Home Price | $1,600,000 |
| Down Payment | $250,000 |
| Interest Rate | 6.0% |
| S&P 500 Return | 11.8% |
| Home Appreciation | 5.4% |
| Annual Maintenance | $15,000 |
| Month 1 Rent | $5,000 |
| Rent Increase | 5.0%/yr |
| Property Tax | 1.25% |

## Tech Stack

- **Backend**: FastAPI, Python
- **Frontend**: Vanilla HTML/JS/CSS, Plotly.js
- **AI**: Anthropic Claude Sonnet 4.6 (streaming via SSE)
