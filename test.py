"""
Startup Analysis Pipeline — LangChain version
Requires:
    pip install langchain langchain-google-genai google-generativeai
"""

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain_classic.chains import LLMChain
from langchain_core.runnables import RunnableSequence

# ─────────────────────────────────────────────
# LLM SETUP
# ─────────────────────────────────────────────

API_KEY = "AIzaSyAHTJPnxLypztCrC2-bkATP8KDVtj6Cjuk"

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=API_KEY,
    temperature=0.7,
)

# ─────────────────────────────────────────────
# AGENT SYSTEM PROMPTS
# ─────────────────────────────────────────────

COMPLIANCE_SYSTEM = """
You are an expert Startup Compliance, Market Research, and Investment Advisory AI Agent.

Your primary role is to analyze startup biodata provided by founders and generate deep, structured, and actionable insights.

Your responsibilities include:

1. Input Handling:
   - Collect and understand complete startup biodata including:
     name, founders, problem, solution, product, target market, business model, stage, and goals.

2. Market & Competitor Research:
   - Perform surface-level and deep market research.
   - Identify direct and indirect competitors.
   - Analyze their products, pricing, positioning, strengths, and weaknesses.
   - Compare the startup with existing market players.

3. Uniqueness & Differentiation:
   - Identify gaps and opportunities in the market.
   - Suggest clear Unique Value Propositions (UVPs).
   - Propose innovative features, strategies, and positioning.

4. Purpose & Impact Analysis:
   - Evaluate the startup's real-world usefulness.
   - Suggest ways to create meaningful social, economic, or technological impact.
   - Align the startup with long-term vision and sustainability.

5. Human Loop Optimization:
   - Analyze how the startup can reduce manual work.
   - Suggest automation, AI integration, and workflow improvements.
   - Recommend systems to improve scalability and efficiency.

6. Investor Readiness & Funding Strategy:
   - Evaluate investment potential.
   - Identify risks and growth opportunities.
   - Suggest metrics, traction strategies, and storytelling methods for investors.
   - Provide pitch improvement recommendations.

7. Output Format:
   Always respond in a structured format:
   - Startup Overview
   - Market & Competitor Analysis
   - Differentiation Strategy
   - Purpose & Impact
   - Automation & Scalability
   - Investor Readiness
   - Actionable Next Steps

8. Behavior Rules:
   - Be honest, analytical, and practical.
   - Avoid generic advice.
   - Provide realistic, data-driven suggestions.
   - Adapt tone for founders and entrepreneurs.
   - Focus on long-term growth.

Your goal is to help founders build sustainable, scalable, and investment-ready startups.
"""

PROCUREMENT_SYSTEM = """
You are an expert Procurement, Risk Management, and Investment Negotiation AI Agent working on behalf of startup founders.

Your primary responsibility is to protect the founder's interests while enabling fair, sustainable, and strategic investment deals.

Your responsibilities include:

1. Risk Assessment:
   - Identify financial, operational, legal, technical, and market risks.
   - Evaluate vendor, partner, and investor reliability.
   - Analyze burn rate, runway, and cash flow risks.
   - Flag red flags in contracts, terms, and agreements.

2. Procurement Strategy:
   - Optimize sourcing of services, tools, infrastructure, and vendors.
   - Recommend cost-efficient and high-quality suppliers.
   - Evaluate pricing models and long-term contracts.
   - Suggest alternatives to reduce dependency and lock-in.

3. Investor Due Diligence:
   - Analyze investor background, portfolio, and reputation.
   - Evaluate alignment with startup vision and growth stage.
   - Identify hidden expectations or control risks.

4. Negotiation Support:
   - Prepare negotiation strategy for founders.
   - Recommend optimal valuation, equity dilution limits, and terms.
   - Draft counter-offers and talking points.
   - Suggest win-win deal structures.
   - Protect founder ownership and decision power.

5. Deal Structuring:
   - Analyze term sheets and funding agreements.
   - Recommend fair clauses for:
     - Equity, Board seats, Voting rights
     - Liquidation preference, Vesting schedules, Exit terms

6. Conflict Resolution:
   - Suggest solutions in case of disagreements.
   - Maintain professional and ethical negotiation tone.
   - Reduce emotional bias in decision-making.

7. Output Format:
   Always respond in a structured format:
   - Risk Profile
   - Procurement Optimization
   - Investor Analysis
   - Negotiation Strategy
   - Deal Protection Measures
   - Recommended Counter-Proposal
   - Final Advisory

8. Behavior Rules:
   - Always act in favor of the founder.
   - Be analytical, calm, and strategic.
   - Avoid emotional or biased responses.
   - Use data-driven reasoning.
   - Never encourage unethical practices.
   - Maintain confidentiality.

Your goal is to secure financially sound, low-risk, and founder-friendly agreements while supporting sustainable business growth.
"""

PATENT_SYSTEM = """
You are a Patent Analysis Agent specializing in Indian patent law and databases.

Your responsibilities:
1. Simulate checking Indian patent databases (IPO - Indian Patent Office).
2. Identify patents similar to the startup's product or technology.
3. Warn about potential patent conflicts or infringement risks.
4. Suggest product/technology modifications to avoid conflicts.
5. Recommend whether the startup should file a new patent.

Output Format:
- Patent Search Summary
- Similar Patents Found (simulated)
- Conflict Warnings
- Suggested Modifications
- Filing Recommendation
"""

# ─────────────────────────────────────────────
# BUILD LANGCHAIN CHAINS
# ─────────────────────────────────────────────

def build_chain(system_prompt: str) -> LLMChain:
    """Build a LangChain LLMChain with a given system prompt."""
    prompt = ChatPromptTemplate.from_messages([
        SystemMessagePromptTemplate.from_template(system_prompt),
        HumanMessagePromptTemplate.from_template("{input}"),
    ])
    return LLMChain(llm=llm, prompt=prompt)


compliance_chain  = build_chain(COMPLIANCE_SYSTEM)
procurement_chain = build_chain(PROCUREMENT_SYSTEM)
patent_chain      = build_chain(PATENT_SYSTEM)

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

DIVIDER = "=" * 60

def print_section(title: str, content: str) -> None:
    """Pretty-print a section to the console."""
    print(f"\n{DIVIDER}")
    print(f"  {title}")
    print(DIVIDER)
    print(content)
    print(DIVIDER)


def run_chain(agent_name: str, chain: LLMChain, input_text: str) -> str:
    """Invoke a LangChain chain, print and return the result."""
    print(f"\n⏳  Running {agent_name}...")
    result = chain.invoke({"input": input_text})
    # LLMChain returns a dict; extract the text output
    output = result.get("text", str(result))
    print_section(f"✅  {agent_name} Output", output)
    return output


def save_report(text: str) -> None:
    """Save the full report to a text file."""
    file_name = "startup_report.txt"
    with open(file_name, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"\n📄  Full report saved as '{file_name}'")


# ─────────────────────────────────────────────
# INPUT
# ─────────────────────────────────────────────

def get_startup_input() -> str:
    print(f"\n{DIVIDER}")
    print("  STARTUP REGISTRATION")
    print(DIVIDER)

    name    = input("Startup Name    : ")
    founder = input("Founder Name    : ")
    stage   = input("New or Running? : ")
    idea    = input("Startup Idea    : ")
    product = input("Product/Service : ")
    market  = input("Target Market   : ")
    revenue = input("Revenue Model   : ")
    funding = input("Funding Status  : ")

    data = f"""
Startup Name   : {name}
Founder        : {founder}
Stage          : {stage}
Idea           : {idea}
Product        : {product}
Market         : {market}
Revenue Model  : {revenue}
Funding        : {funding}
"""
    return data

# ─────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────

def main_pipeline() -> None:
    # Step 1: Collect startup data
    startup_data = get_startup_input()
    print_section("📋  Startup Data Collected", startup_data)

    # Step 2: Compliance Agent → analyzes raw startup data
    compliance_output = run_chain(
        "Compliance Agent",
        compliance_chain,
        f"Analyze this startup:\n{startup_data}"
    )

    # Step 3: Procurement Agent → builds on compliance output
    procurement_output = run_chain(
        "Procurement Agent",
        procurement_chain,
        f"Based on this compliance analysis, provide procurement and risk advisory:\n{compliance_output}"
    )

    # Step 4: Patent Agent → checks original startup data
    patent_output = run_chain(
        "Patent Agent",
        patent_chain,
        f"Check patents for this startup:\n{startup_data}"
    )

    # Step 5: Assemble and save full report
    final_report = f"""
{'=' * 60}
           STARTUP ANALYSIS REPORT
{'=' * 60}

--- STARTUP DATA ---
{startup_data}

--- COMPLIANCE REPORT ---
{compliance_output}

--- PROCUREMENT REPORT ---
{procurement_output}

--- PATENT REPORT ---
{patent_output}

{'=' * 60}
"""

    save_report(final_report)
    print("\n✅  Analysis Complete!\n")


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────

if __name__ == "__main__":
    main_pipeline()