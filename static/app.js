const SLIDERS = [
    { id: "home_price", fmt: "dollar" },
    { id: "down_payment", fmt: "dollar" },
    { id: "interest_rate", fmt: "percent" },
    { id: "sp500_return", fmt: "percent" },
    { id: "house_appreciation", fmt: "percent" },
    { id: "annual_maintenance", fmt: "dollar" },
    { id: "monthly_rent", fmt: "dollar" },
    { id: "annual_rent_increase", fmt: "percent" },
    { id: "property_tax_rate", fmt: "percent" },
];

let chartMode = "cumulative";
let lastData = null;

function fmtDollar(n) {
    return "$" + Math.round(n).toLocaleString();
}

function fmtPercent(n) {
    return n.toFixed(1) + "%";
}

function formatDisplay(val, fmt) {
    return fmt === "dollar" ? fmtDollar(val) : fmtPercent(parseFloat(val));
}

// Sync slider <-> number input and display
SLIDERS.forEach(({ id, fmt }) => {
    const slider = document.getElementById(id);
    const numInput = document.getElementById(id + "_val");
    const display = document.getElementById(id + "_display");

    slider.addEventListener("input", () => {
        numInput.value = slider.value;
        display.textContent = formatDisplay(slider.value, fmt);
        debouncedCalculate();
    });

    numInput.addEventListener("input", () => {
        slider.value = numInput.value;
        display.textContent = formatDisplay(numInput.value, fmt);
        debouncedCalculate();
    });
});

function getSliderValues() {
    const vals = {};
    SLIDERS.forEach(({ id }) => {
        vals[id] = parseFloat(document.getElementById(id).value);
    });
    return vals;
}

let calcTimer = null;
function debouncedCalculate() {
    clearTimeout(calcTimer);
    calcTimer = setTimeout(calculate, 150);
}

async function calculate() {
    const params = getSliderValues();
    try {
        const res = await fetch("/api/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
        });
        const data = await res.json();
        lastData = data;
        updateTable(data);
        updateChart(data);
    } catch (e) {
        console.error("Calculation error:", e);
    }
}

function updateTable(data) {
    const snapshots = [1, 5, 10, 15, 20, 30];
    const rows = {
        "row-appreciation": "appreciation",
        "row-rent-savings": "cumulative_rent",
        "row-mortgage": "cumulative_mortgage",
        "row-opportunity": "opportunity_cost",
        "row-property-tax": "cumulative_property_tax",
        "row-maintenance": "cumulative_maintenance",
        "row-net": "net_value",
    };

    for (const [rowId, key] of Object.entries(rows)) {
        const row = document.getElementById(rowId);
        const cells = row.querySelectorAll("td");
        snapshots.forEach((yr, i) => {
            const yearData = data.years[yr - 1];
            const val = yearData[key];
            cells[i + 1].textContent = fmtDollar(val);
            if (key === "net_value") {
                cells[i + 1].className = val >= 0 ? "positive" : "negative";
            }
        });
    }

    document.getElementById("monthly-payment-val").textContent = fmtDollar(data.monthly_payment);
    document.getElementById("total-paid-val").textContent = fmtDollar(data.years[29].cumulative_mortgage);
}

function updateChart(data) {
    const years = data.years.map((d) => d.year);

    const hovertemplate = "%{fullData.name}<br>Year %{x}: %{y:$,.0f}<extra></extra>";

    if (chartMode === "cumulative") {
        const traces = [
            {
                x: years,
                y: data.years.map((d) => d.appreciation),
                name: "Appreciation",
                type: "scatter",
                mode: "lines",
                line: { color: "#16a34a", width: 2 },
                hovertemplate,
            },
            {
                x: years,
                y: data.years.map((d) => d.cumulative_rent),
                name: "Rent Savings",
                type: "scatter",
                mode: "lines",
                line: { color: "#2563eb", width: 2 },
                hovertemplate,
            },
            {
                x: years,
                y: data.years.map((d) => -d.cumulative_mortgage),
                name: "Mortgage Payments",
                type: "scatter",
                mode: "lines",
                line: { color: "#dc2626", width: 2 },
                hovertemplate,
            },
            {
                x: years,
                y: data.years.map((d) => -d.opportunity_cost),
                name: "Opportunity Cost",
                type: "scatter",
                mode: "lines",
                line: { color: "#f97316", width: 2 },
                hovertemplate,
            },
            {
                x: years,
                y: data.years.map((d) => -d.cumulative_property_tax),
                name: "Property Tax",
                type: "scatter",
                mode: "lines",
                line: { color: "#8b5cf6", width: 2 },
                hovertemplate,
            },
            {
                x: years,
                y: data.years.map((d) => -d.cumulative_maintenance),
                name: "Maintenance",
                type: "scatter",
                mode: "lines",
                line: { color: "#64748b", width: 2 },
                hovertemplate,
            },
            {
                x: years,
                y: data.years.map((d) => d.net_value),
                name: "Net Value",
                type: "scatter",
                mode: "lines",
                line: { color: "#0f172a", width: 3, dash: "dash" },
                hovertemplate,
            },
        ];

        Plotly.newPlot("chart", traces, {
            title: "Buy vs Rent: Factor Breakdown",
            xaxis: { title: "Year", dtick: 5 },
            yaxis: { title: "Value ($)", tickformat: "$,.0f" },
            legend: { orientation: "h", y: -0.2, x: 0.5, xanchor: "center" },
            margin: { t: 50, r: 30, b: 120 },
            hoverlabel: { namelength: -1 },
        }, { responsive: true });
    } else {
        const traces = [
            {
                x: years,
                y: data.years.map((d) => d.net_value),
                name: "Net Value (Buy vs Rent)",
                type: "bar",
                marker: {
                    color: data.years.map((d) =>
                        d.net_value >= 0 ? "#16a34a" : "#dc2626"
                    ),
                },
                hovertemplate: "Year %{x}: %{y:$,.0f}<extra></extra>",
            },
        ];

        Plotly.newPlot("chart", traces, {
            title: "Net Value of Buying by Year",
            xaxis: { title: "Year", dtick: 5 },
            yaxis: { title: "Net Value ($)", tickformat: "$,.0f" },
            margin: { t: 50, r: 30 },
            hoverlabel: { namelength: -1 },
        }, { responsive: true });
    }
}

// Chart toggle buttons
document.querySelectorAll(".chart-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".chart-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        chartMode = btn.dataset.mode;
        if (lastData) updateChart(lastData);
    });
});

// Chat
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");

chatSend.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
    }
});

async function sendChat() {
    const message = chatInput.value.trim();
    if (!message) return;

    appendMessage("user", message);
    chatInput.value = "";
    chatSend.disabled = true;

    const assistantDiv = appendMessage("assistant", "");
    const contentP = assistantDiv.querySelector("p");

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: message,
                sliders: getSliderValues(),
            }),
        });

        if (!res.ok) {
            const err = await res.json();
            contentP.textContent = err.error || "Error connecting to chat.";
            chatSend.disabled = false;
            return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const payload = line.slice(6);
                    if (payload === "[DONE]") break;
                    try {
                        const parsed = JSON.parse(payload);
                        fullText += parsed.text;
                        contentP.innerHTML = simpleMarkdown(fullText);
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    } catch {}
                }
            }
        }
    } catch (e) {
        contentP.textContent = "Error: Could not connect to chat service.";
    }

    chatSend.disabled = false;
}

function simpleMarkdown(text) {
    // Escape HTML
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

    // Code blocks (``` ... ```)
    html = html.replace(/```[\s\S]*?```/g, (match) => {
        const code = match.slice(3, -3).replace(/^\w*\n/, "");
        return "<pre><code>" + code + "</code></pre>";
    });

    // Process line by line
    const lines = html.split("\n");
    const result = [];
    let inList = false;
    let listType = null;
    let inTable = false;
    let isHeaderRow = true;

    for (let line of lines) {
        // Skip separator rows in tables (|---|---|)
        if (line.match(/^\|[\s\-:|]+\|$/)) {
            continue;
        }

        // Table rows
        if (line.match(/^\|(.+)\|$/)) {
            if (!inTable) {
                if (inList) { result.push(`</${listType}>`); inList = false; }
                result.push("<table>");
                inTable = true;
                isHeaderRow = true;
            }
            const cells = line.split("|").filter((c, i, a) => i > 0 && i < a.length - 1);
            const tag = isHeaderRow ? "th" : "td";
            result.push("<tr>" + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join("") + "</tr>");
            isHeaderRow = false;
            continue;
        }

        if (inTable) {
            result.push("</table>");
            inTable = false;
        }

        // Headers
        if (line.match(/^#{1,3}\s/)) {
            if (inList) { result.push(`</${listType}>`); inList = false; }
            const level = line.match(/^(#+)/)[1].length;
            const text = line.replace(/^#+\s*/, "");
            result.push(`<h${level + 2}>${text}</h${level + 2}>`);
            continue;
        }

        // Bullet list items
        if (line.match(/^[-*]\s/)) {
            if (inList && listType !== "ul") { result.push(`</${listType}>`); inList = false; }
            if (!inList) { result.push("<ul>"); inList = true; listType = "ul"; }
            result.push("<li>" + line.replace(/^[-*]\s*/, "") + "</li>");
            continue;
        }

        // Numbered list
        if (line.match(/^\d+\.\s/)) {
            if (inList && listType !== "ol") { result.push(`</${listType}>`); inList = false; }
            if (!inList) { result.push("<ol>"); inList = true; listType = "ol"; }
            result.push("<li>" + line.replace(/^\d+\.\s*/, "") + "</li>");
            continue;
        }

        if (inList) {
            result.push(`</${listType}>`);
            inList = false;
        }

        if (line.trim() === "") {
            result.push("<br>");
        } else {
            result.push(line);
        }
    }
    if (inList) result.push(`</${listType}>`);
    if (inTable) result.push("</table>");

    html = result.join("\n");

    // Inline formatting
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Remaining newlines to <br> (but not after block elements)
    html = html.replace(/(?<!<\/(?:li|ul|ol|pre|h[2-5]|br)>)\n/g, "<br>");

    return html;
}

function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = "chat-msg " + role;
    const p = document.createElement("p");
    if (role === "user") {
        p.textContent = text;
    } else {
        p.innerHTML = simpleMarkdown(text);
    }
    div.appendChild(p);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
}

// Metrics modal
const metricsBtn = document.getElementById("metrics-btn");
const metricsModal = document.getElementById("metrics-modal");
const metricsClose = document.getElementById("metrics-close");
const metricsHeader = document.getElementById("metrics-header");

metricsBtn.addEventListener("click", () => {
    metricsModal.classList.toggle("hidden");
});

metricsClose.addEventListener("click", () => {
    metricsModal.classList.add("hidden");
});

// Draggable modal
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

metricsHeader.addEventListener("mousedown", (e) => {
    isDragging = true;
    const rect = metricsModal.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    metricsModal.style.transition = "none";
    e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    metricsModal.style.left = (e.clientX - dragOffsetX) + "px";
    metricsModal.style.top = (e.clientY - dragOffsetY) + "px";
    metricsModal.style.right = "auto";
    metricsModal.style.bottom = "auto";
});

document.addEventListener("mouseup", () => {
    isDragging = false;
});

// Initial calculation
calculate();
