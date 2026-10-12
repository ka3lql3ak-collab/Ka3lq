"""Book-level text for the Kindle eBook edition (a devotional to read; answers go in a notebook)."""

TITLE = "A Little Time with God"
SUBTITLE = "A 90-Day Devotional and Prayer Guide for Young Christian Women"
TAGLINE = "Pray  ·  Grow  ·  Walk Closer"
AUTHOR = "digiByDK"
YEAR = 2026
LANG = "en-US"

WELCOME = [
    "This 90-day journal is your invitation to slow down, be still, and spend intentional time with the One who loves you most. "
    "Whether you're new to prayer or you've prayed for years but want to be more consistent, this journal will help you build "
    "a daily prayer habit that fits your real life.",
    "You don't have to have it all figured out. You don't need perfect words, a perfect schedule, or a perfect quiet morning. "
    "You just need a willingness to show up, and God will meet you there.",
    "Each day takes about ten minutes. Some days you'll write a lot. Some days you'll write one sentence. Both count.",
]

HOW_TO_USE = [
    ("Read the verse", "Each day opens with a short passage of Scripture. Read it slowly, twice if you can."),
    ("Sit with the thought", "A brief reflection helps you see how the verse speaks to everyday life."),
    ("Reflect honestly", "Answer the question in your own words. There are no wrong answers."),
    ("Pray", "Use the prayer starter if it helps, then keep going in your own words, as naturally as you would speak."),
    ("Give thanks", "Name one thing you're grateful for. Small things count."),
    ("Check in", "Mark that you showed up. Every few days of faithfulness add up to a habit."),
]

HOW_TO_EBOOK_NOTE = (
    "Keep a notebook or the notes app on your phone beside you as you read. Each day's questions are written "
    "for you to answer there, so your Kindle stays clean and your notebook becomes a record of everything God does over these 90 days."
)

ROUTINE_QUESTIONS = [
    "What time of day works best for me to pray: morning, afternoon, or evening?",
    "Where is my prayer space?",
    "How long will I start with: 5 minutes, 10 minutes, or 15 minutes or more?",
    "What usually gets in the way, and what is my plan when it does?",
    "Who could encourage me or check in with me along the way?",
]

REVIEW_QUESTIONS = [
    "What went well this week?",
    "What was challenging?",
    "What helped me stay consistent?",
    "How did I see God at work this week?",
    "What do I want to do differently next week?",
]

MISS_A_DAY_INTRO = (
    "Everyone misses a day. What matters is that you come back. "
    "God's mercies are new every morning, and so is your journal. Skip the guilt and simply pick up where you left off."
)
MISS_A_DAY_QUESTIONS = ["What happened?", "What can I learn from this?"]
MISS_A_DAY_STEPS = ["Pray now, even for one minute", "Set a reminder on my phone", "Adjust my routine",
                    "Ask a friend for support"]

ANSWERED_INTRO = "Look back. Give thanks. Keep going. Record the ways God has answered, even when the answer looked different than you expected."
ANSWERED_FIELDS = ["Prayer I prayed:", "What God did:", "What I'm learning:"]
ANSWERED_FEELINGS = ["Grateful", "Peaceful", "More confident"]

FINAL_QUESTIONS = [
    "How has my prayer life changed over these 90 days?",
    "Which day or verse meant the most to me, and why?",
    "What has God taught me about who He is?",
    "What has God taught me about who I am?",
]

NEXT_30_INTRO = "Keep the momentum going. A habit is built in 90 days, but it's kept one day at a time."
NEXT_30_HABITS = ["Daily prayer", "Scripture reading", "Gratitude", "Praying for others"]

CLOSING = ("Keep praying.", "Keep growing.", "Keep going.")
CLOSING_LINE = "You are closer to the life God has for you than you think."

THANK_YOU = [
    "Thank you for spending these 90 days with this journal. My prayer is that it has helped you discover how much "
    "God loves to spend time with you.",
    "If this journal encouraged you, would you consider leaving a short review on Amazon? Your words help other women "
    "find a place to begin their own prayer journey.",
]

SCRIPTURE_NOTE = (
    "Scripture quotations are from the World English Bible (WEB), which is in the public domain. "
    "The divine name is rendered “the LORD,” as in many WEB editions."
)


from content.typography import smart as _smart


def _fix(v):
    if isinstance(v, str):
        return _smart(v)
    if isinstance(v, list):
        return [_fix(x) for x in v]
    if isinstance(v, tuple):
        return tuple(_fix(x) for x in v)
    return v


for _k, _v in list(globals().items()):
    if _k.isupper():
        globals()[_k] = _fix(_v)
