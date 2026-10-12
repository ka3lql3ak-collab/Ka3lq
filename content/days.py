"""Daily content for *A Little Time with God*.

Each day: title, scripture ref (World English Bible text is pulled into data/verses.json),
a short devotional thought, a reflection question, and a prayer starter.
"""

WEEKS = [
    ("Beginning Well", "Learning that prayer is simply talking with God."),
    ("Drawing Near", "Discovering that God is closer than you think."),
    ("Learning to Trust", "Handing God the things you can't control."),
    ("Peace for an Anxious Heart", "Trading worry for His peace."),
    ("Who God Says You Are", "Seeing yourself the way He sees you."),
    ("A Grateful Heart", "Noticing His goodness in ordinary days."),
    ("Grace and Forgiveness", "Receiving mercy, and learning to give it."),
    ("Waiting on God", "Finding hope in the in-between."),
    ("Strength for Hard Days", "Leaning on Him when you feel weak."),
    ("Loving Others Well", "Letting prayer shape how you love."),
    ("Purpose and Calling", "Living your everyday life for Him."),
    ("Rest for Your Soul", "Slowing down in His presence."),
    ("Hope That Lasts", "Finishing strong, and walking on."),
]

PARTS = [
    (1, "Part One", "Building the Habit", "Days 1–30",
     "The first weeks are about showing up. Don't worry about saying the right things or filling every line. "
     "A few honest minutes with God each day is how every strong prayer life begins."),
    (31, "Part Two", "Going Deeper", "Days 31–60",
     "You've started something beautiful. In this season you'll learn to bring God your whole self: "
     "your gratitude, your mistakes, your waiting, and your hard days. He wants all of it."),
    (61, "Part Three", "Walking Closer", "Days 61–90",
     "Prayer is becoming part of who you are. These final weeks turn your attention outward and onward: "
     "loving others, living with purpose, resting well, and holding on to hope."),
]

DAYS = [
    # Week 1 — A Fresh Start
    dict(title="A Fresh Start", ref="Proverbs 16:3",
         thought="Every new habit starts small, and prayer is no different. You don't need a perfect plan or polished words. "
                 "Today, simply hand God this journey. Ask Him to meet you here each day and to shape this time into something that lasts.",
         question="What do you hope will change in your life as you spend time with God?",
         prayer="Lord, I'm giving You these ninety days. Teach me to pray, and help me keep showing up."),
    dict(title="Come As You Are", ref="Matthew 11:28-29",
         thought="Jesus doesn't ask you to get it together before you come to Him. He invites the tired, the busy, and the overwhelmed. "
                 "His heart toward you is gentle. Whatever you're carrying today, you can bring it to Him exactly as it is.",
         question="What burden are you carrying into today's prayer time?",
         prayer="Jesus, I'm coming to You as I am. Thank You for being gentle with me. Give my soul rest."),
    dict(title="He Is Listening", ref="1 John 5:14",
         thought="Sometimes prayer can feel like talking to the ceiling. But Scripture promises that God hears you. "
                 "Not just the eloquent prayers, not just the long ones. Every honest word you speak reaches the One who loves you.",
         question="Do you ever doubt that God hears you? Tell Him honestly.",
         prayer="Father, thank You that You listen to me. Help me pray with confidence, knowing You hear."),
    dict(title="Simple Words Are Enough", ref="Matthew 6:7-8",
         thought="You don't have to impress God with many words. He already knows what you need before you ask. "
                 "Prayer isn't a performance; it's a conversation with a Father who loves you. Short, simple, and sincere is more than enough.",
         question="If you could only say three sentences to God today, what would they be?",
         prayer="God, You know my heart better than I do. Here are my simple words, offered with love."),
    dict(title="A Quiet Place", ref="Mark 1:35",
         thought="Even Jesus, surrounded by crowds and needs, made space to be alone with His Father. "
                 "A quiet place doesn't have to be fancy: a corner of your room, your car before work, a walk outside. What matters is that you show up there.",
         question="Where is your quiet place? What could make it feel more set apart?",
         prayer="Lord, help me guard a small, quiet space in my day that belongs to You."),
    dict(title="Ask, Seek, Knock", ref="Matthew 7:7-8",
         thought="Jesus invites you to keep asking, keep seeking, and keep knocking. Persistence in prayer isn't nagging God. "
                 "It's trusting that He is good and that He cares about your requests, big and small.",
         question="What have you stopped asking God for? Why?",
         prayer="Father, I bring my requests to You again today, trusting that You are good and You care."),
    dict(title="Rooted in His Word", ref="Psalms 1:2-3",
         thought="A tree doesn't grow strong in a day. It grows by staying planted near the water. "
                 "When you return to God's Word again and again, your faith grows deep roots that hold you steady through every season.",
         question="Which verse from this first week do you want to carry with you?",
         prayer="Lord, plant me deep in Your Word. Let my life bear fruit that lasts."),

    # Week 2 — Drawing Near
    dict(title="Draw Near", ref="James 4:8",
         thought="Here is a beautiful promise: when you take a step toward God, He steps toward you. "
                 "You don't have to close the whole distance yourself. Your small movement toward Him is met by His great love.",
         question="What is one small step you can take toward God today?",
         prayer="God, I'm drawing near to You. Thank You for coming close to me."),
    dict(title="Be Still", ref="Psalms 46:10",
         thought="Stillness is rare in a world of notifications and to-do lists. But some things can only be known in quiet. "
                 "Before you write or pray today, take one full minute to be still, breathe, and remember who God is.",
         question="What noise in your life makes it hard to be still?",
         prayer="Lord, quiet my mind and my heart. Help me know that You are God."),
    dict(title="Never Alone", ref="Deuteronomy 31:8",
         thought="Wherever today takes you, God has already gone ahead. He is in the meeting, the classroom, the hard conversation, the quiet evening. "
                 "You are never walking into anything alone.",
         question="Where do you need to remember that God has gone before you?",
         prayer="Father, thank You for going before me. I won't be afraid, because You are with me."),
    dict(title="He Knows Your Name", ref="Isaiah 43:1",
         thought="You are not a face in the crowd to God. He formed you, He redeemed you, and He calls you by name. "
                 "Let those three words sink in today: You are mine.",
         question="How does it feel to know that God calls you His own?",
         prayer="Lord, thank You for knowing me by name. Help me live like I belong to You."),
    dict(title="The God Who Sees", ref="Genesis 16:13",
         thought="Hagar was alone, mistreated, and running away when God found her in the wilderness. "
                 "She gave Him a name: the God who sees. He sees you too: the parts you show the world and the parts you hide.",
         question="What part of your life do you need God to see right now?",
         prayer="God who sees me, thank You for noticing what others miss. I'm not invisible to You."),
    dict(title="Fullness of Joy", ref="Psalms 16:11",
         thought="Real joy isn't found in a perfect life; it's found in God's presence. "
                 "As you spend time with Him, you may notice a quiet gladness growing in you that doesn't depend on circumstances.",
         question="When have you felt joy in God's presence?",
         prayer="Lord, show me the path of life. Fill me with the joy of being near You."),
    dict(title="Abide", ref="John 15:5",
         thought="A branch doesn't strain to produce fruit. It simply stays connected to the vine. "
                 "Your daily prayer time is how you stay connected. Fruit like peace, patience, and kindness will grow from that place.",
         question="What helps you feel connected to God throughout your day?",
         prayer="Jesus, I want to stay close to You. Apart from You I can do nothing."),

    # Week 3 — Learning to Trust
    dict(title="With All Your Heart", ref="Proverbs 3:5-6",
         thought="Trusting God with part of your heart is easy. Trusting Him with all of it, including your plans, relationships, and future, takes courage. "
                 "Today, name one area you've been holding back and place it in His hands.",
         question="What area of your life is hardest to trust God with?",
         prayer="Lord, I choose to trust You with all my heart, not just the easy parts."),
    dict(title="Higher Ways", ref="Isaiah 55:8-9",
         thought="There will be moments when God's ways don't make sense to you. That's okay. "
                 "His perspective is higher and wider than yours. Trust doesn't require understanding everything; it requires knowing who He is.",
         question="What situation are you struggling to understand right now?",
         prayer="Father, Your ways are higher than mine. Help me trust You even when I don't understand."),
    dict(title="He Will Fight for You", ref="Exodus 14:14",
         thought="The Israelites stood between an army and a sea, with nowhere to go. God's instruction? Be still. "
                 "Some battles aren't yours to fight in your own strength. Let Him be your defender today.",
         question="What battle do you need to let God fight for you?",
         prayer="Lord, I'm tired of fighting alone. I'm stepping back and trusting You to fight for me."),
    dict(title="Faith Is Assurance", ref="Hebrews 11:1",
         thought="Faith is not pretending everything is fine. It's confident hope in what God has promised, even when you can't see it yet. "
                 "Every prayer you pray is an act of faith that He is real and He is good.",
         question="What are you hoping for that you can't see yet?",
         prayer="God, strengthen my faith. Help me hold on to what You have promised."),
    dict(title="Thoughts of Peace", ref="Jeremiah 29:11",
         thought="God spoke these words to people living in exile, far from home and unsure of tomorrow. "
                 "Even in seasons that feel like waiting or wandering, His thoughts toward you are peace, hope, and a future.",
         question="What does a hopeful future look like to you?",
         prayer="Lord, thank You that Your thoughts toward me are good. I trust You with my future."),
    dict(title="All Things Together", ref="Romans 8:28",
         thought="This verse doesn't promise that everything will be easy. It promises that God can weave even painful things into something good. "
                 "Nothing in your story is wasted in His hands.",
         question="Looking back, where have you seen God bring good out of something hard?",
         prayer="Father, I believe You are working all things together for good in my life."),
    dict(title="When I Am Afraid", ref="Psalms 56:3-4",
         thought="David didn't say if I am afraid, but when. Fear is part of being human. "
                 "The question isn't whether fear will come; it's what you'll do with it. David chose to bring his fear to God and trust Him.",
         question="What fear can you hand over to God today?",
         prayer="Lord, when I am afraid, I will trust in You. Replace my fear with Your peace."),

    # Week 4 — Peace for an Anxious Heart
    dict(title="Cast Your Cares", ref="1 Peter 5:7",
         thought="To cast something means to throw it: not set it down gently so you can pick it back up later. "
                 "God invites you to throw all your worries onto Him, because He genuinely cares about you.",
         question="List the worries you're casting on God today.",
         prayer="God, I'm throwing these worries onto You. Thank You for caring about every one of them."),
    dict(title="One Day at a Time", ref="Matthew 6:34",
         thought="So much anxiety comes from living in tomorrow. Jesus gently pulls you back to today. "
                 "You only have grace for this day, and this day is enough to focus on.",
         question="What tomorrow-worry can you set aside to focus on today?",
         prayer="Jesus, help me live in today. I'll trust You with tomorrow."),
    dict(title="Peace That Guards", ref="Philippians 4:6-7",
         thought="Here's a simple pattern: pray about everything, say thank you, and let God's peace stand guard over your heart. "
                 "His peace doesn't always make sense, and that's what makes it so powerful.",
         question="What would you pray about if you truly brought God everything?",
         prayer="Lord, I bring You my requests with a thankful heart. Guard my heart and mind with Your peace."),
    dict(title="Perfect Peace", ref="Isaiah 26:3",
         thought="Where your mind goes, your heart follows. When your thoughts keep returning to God, peace follows. "
                 "Today, notice where your mind drifts, and gently turn it back to Him.",
         question="What thoughts tend to steal your peace?",
         prayer="God, keep my mind fixed on You. Fill me with Your perfect peace."),
    dict(title="I Will Uphold You", ref="Isaiah 41:10",
         thought="Read this verse slowly and notice every promise: I am with you. I am your God. I will strengthen you. I will help you. I will uphold you. "
                 "That's five promises for whatever you're facing.",
         question="Which of these promises do you need most today?",
         prayer="Lord, thank You for being with me, strengthening me, and holding me up."),
    dict(title="My Shepherd", ref="Psalms 23:1-3",
         thought="A good shepherd knows when his sheep need rest, water, and guidance. "
                 "God leads you the same way, sometimes toward stillness you didn't know you needed. Let Him restore your soul today.",
         question="Where do you need God to lead you to still waters?",
         prayer="Lord, You are my shepherd. Lead me, restore me, and guide me today."),
    dict(title="Not as the World Gives", ref="John 14:27",
         thought="The world offers peace that depends on everything going right. Jesus offers peace that holds even when things go wrong. "
                 "It's His gift to you: receive it today.",
         question="What would it look like to receive Jesus' peace this week?",
         prayer="Jesus, I receive Your peace. Calm my troubled heart."),

    # Week 5 — Who God Says You Are
    dict(title="Wonderfully Made", ref="Psalms 139:14",
         thought="In a world full of comparison and filters, God's opinion of you is settled: you are fearfully and wonderfully made. "
                 "He didn't make a mistake when He made you.",
         question="What would change if you truly believed you are wonderfully made?",
         prayer="God, thank You for making me. Help me see myself the way You see me."),
    dict(title="His Workmanship", ref="Ephesians 2:10",
         thought="You are God's handiwork, His work of art, created on purpose and for a purpose. "
                 "The good things He has for you to do were planned before you were born.",
         question="What good work might God be inviting you into right now?",
         prayer="Lord, I'm Your workmanship. Show me the good works You've prepared for me."),
    dict(title="Chosen", ref="1 Peter 2:9",
         thought="You were chosen, not as an afterthought, not as a backup plan. "
                 "God called you out of darkness into His marvelous light, and your life can point others to His goodness.",
         question="Where have you felt overlooked? How does being chosen by God speak to that?",
         prayer="Father, thank You for choosing me. Let my life shine with Your light."),
    dict(title="A New Creation", ref="2 Corinthians 5:17",
         thought="Your past doesn't get the final word. In Christ, the old has gone and the new has come. "
                 "You don't have to keep living as who you used to be.",
         question="What old label do you need to let go of?",
         prayer="Jesus, thank You for making me new. Help me walk in the freedom You give."),
    dict(title="No Condemnation", ref="Romans 8:1",
         thought="That critical voice in your head is not God's voice. In Christ, there is no condemnation: none. "
                 "God may gently correct you, but He will never shame you.",
         question="What do you tend to condemn yourself for?",
         prayer="Lord, silence every voice of condemnation. Thank You for Your grace."),
    dict(title="Beauty That Lasts", ref="1 Peter 3:3-4",
         thought="Outward beauty fades, but a gentle and quiet spirit is precious to God. "
                 "This isn't about being quiet or shy; it's about a heart at rest in Him, which is a beauty no one can take away.",
         question="What inner quality do you want God to grow in you?",
         prayer="God, make me beautiful on the inside. Grow a gentle, peaceful spirit in me."),
    dict(title="Daughter of God", ref="1 John 3:1",
         thought="Read it again: See how great a love the Father has given to us! "
                 "You are not just forgiven or tolerated. You are called His child, a beloved daughter of the King.",
         question="How does being God's daughter change how you see today?",
         prayer="Father, thank You for calling me Your child. Help me rest in Your love."),

    # Week 6 — A Grateful Heart
    dict(title="In Everything", ref="1 Thessalonians 5:16-18",
         thought="Notice it says in everything, not for everything. You don't have to be thankful for pain. "
                 "But in every situation, you can find something to thank God for, and that changes how you see it.",
         question="What is one thing you can thank God for in a hard situation?",
         prayer="Lord, teach me to rejoice, pray, and give thanks in every season."),
    dict(title="He Is Good", ref="Psalms 107:1",
         thought="Gratitude starts with remembering who God is. He is good: not sometimes, not when things go well, but always. "
                 "His loving kindness never runs out.",
         question="Where have you seen God's goodness this week?",
         prayer="God, thank You for being good. Your loving kindness endures forever."),
    dict(title="New Every Morning", ref="Lamentations 3:22-23",
         thought="These words were written in the middle of grief. Even there, the writer found hope: God's mercies are new every morning. "
                 "Yesterday's mistakes don't use up today's grace.",
         question="What do you need a fresh start with today?",
         prayer="Lord, thank You for new mercies this morning. Great is Your faithfulness."),
    dict(title="Every Good Gift", ref="James 1:17",
         thought="The warm coffee, the friend who texted, the sunset on your drive home. Every good gift comes from God. "
                 "Gratitude is simply learning to trace the good things back to Him.",
         question="List five small good gifts from the last 24 hours.",
         prayer="Father, every good thing in my life comes from You. Thank You."),
    dict(title="Don't Forget", ref="Psalms 103:2",
         thought="We forget so easily. Yesterday's answered prayer gets buried under today's new worry. "
                 "That's why writing things down matters. Your journal becomes a record of God's faithfulness.",
         question="What has God done for you that you don't want to forget?",
         prayer="Lord, help me remember all You've done. I praise You with my whole soul."),
    dict(title="The One Who Returned", ref="Luke 17:15-16",
         thought="Ten people were healed, but only one came back to say thank you. "
                 "Gratitude is a choice to turn around and acknowledge the One who blessed you.",
         question="Is there a blessing you've received but never thanked God for?",
         prayer="Jesus, I'm turning back to say thank You. You have been so kind to me."),
    dict(title="Contentment", ref="1 Timothy 6:6",
         thought="Contentment isn't settling; it's knowing that with God, you already have what matters most. "
                 "Comparison steals joy, but gratitude gives it back.",
         question="Where are you tempted to compare? What could you be grateful for instead?",
         prayer="God, teach me contentment. You are more than enough for me."),

    # Week 7 — Grace and Forgiveness
    dict(title="Faithful to Forgive", ref="1 John 1:9",
         thought="Confession isn't about earning forgiveness. It's about bringing what's hidden into the light, where God's grace can heal it. "
                 "He is faithful to forgive, every single time.",
         question="Is there anything you need to confess to God today?",
         prayer="Lord, I confess my sin to You. Thank You for forgiving me and making me clean."),
    dict(title="East from West", ref="Psalms 103:12",
         thought="East and west never meet. That's how far God has removed your sins from you. "
                 "He doesn't hold them over you or bring them up again. You can stop carrying what He has already removed.",
         question="What forgiven sin are you still carrying?",
         prayer="Father, thank You for removing my sins so far away. Help me let them go too."),
    dict(title="A Clean Heart", ref="Psalms 51:10",
         thought="David prayed this after his biggest failure. He didn't make excuses; he asked God to make his heart new. "
                 "God loves to answer this prayer.",
         question="What do you want God to renew in your heart?",
         prayer="Create in me a clean heart, O God. Renew a right spirit within me."),
    dict(title="As You Were Forgiven", ref="Colossians 3:13",
         thought="Forgiving someone doesn't mean what they did was okay. It means you're releasing them to God and refusing to let bitterness take root in you. "
                 "It's often a process, and that's okay.",
         question="Who do you need to begin forgiving?",
         prayer="Lord, You've forgiven me so much. Help me begin to forgive the people who have hurt me."),
    dict(title="Tender Hearted", ref="Ephesians 4:32",
         thought="Kindness and tenderness are choices you make again and again. "
                 "When you remember how gently God has treated you, it becomes easier to treat others gently too.",
         question="Who could use your kindness this week?",
         prayer="God, make my heart tender. Help me be kind the way You are kind to me."),
    dict(title="Sufficient Grace", ref="2 Corinthians 12:9",
         thought="Paul asked God to take away his struggle. God's answer was, My grace is sufficient. "
                 "Sometimes God doesn't remove the weakness; He fills it with His strength.",
         question="Where do you need God's grace to be enough today?",
         prayer="Lord, Your grace is enough for me. Show Your strength in my weakness."),
    dict(title="He Delights in Mercy", ref="Micah 7:18",
         thought="God doesn't forgive you reluctantly. He delights in loving kindness. "
                 "Mercy isn't something He has to work up to; it's who He is.",
         question="How does it change things to know God delights in showing you mercy?",
         prayer="God, there is no one like You. Thank You for delighting in mercy."),

    # Week 8 — Waiting on God
    dict(title="Wings Like Eagles", ref="Isaiah 40:31",
         thought="Waiting on God isn't passive. It's an active trust that renews your strength. "
                 "Eagles don't flap harder in a storm; they rise on the wind. Let God lift you.",
         question="What are you waiting on God for right now?",
         prayer="Lord, as I wait for You, renew my strength. Help me rise above my circumstances."),
    dict(title="Take Courage", ref="Psalms 27:14",
         thought="It takes courage to wait. It's tempting to rush ahead, give up, or take control. "
                 "This verse says it twice for a reason: wait for the LORD.",
         question="Where are you tempted to rush ahead of God?",
         prayer="Father, give me courage to wait for You. Strengthen my heart."),
    dict(title="A Season for Everything", ref="Ecclesiastes 3:1",
         thought="You are in a season, and seasons change. What feels permanent right now is not the whole story. "
                 "God is present in this season and the next.",
         question="How would you describe the season you're in right now?",
         prayer="Lord, help me trust You in this season. I know it won't last forever."),
    dict(title="It Will Surely Come", ref="Habakkuk 2:3",
         thought="God's timing is rarely our timing. But His promises are never late. "
                 "What feels like delay may actually be preparation.",
         question="What promise from God are you holding on to?",
         prayer="God, I believe You will keep Your promises. Help me wait with hope."),
    dict(title="Patient in Hope", ref="Romans 12:12",
         thought="Three short phrases for every hard season: rejoice in hope, endure in trouble, keep praying. "
                 "That last one is exactly what you're doing right now. Keep going.",
         question="Which of these three is hardest for you right now?",
         prayer="Lord, help me rejoice in hope, endure in trouble, and keep praying."),
    dict(title="He Heard My Cry", ref="Psalms 40:1",
         thought="David waited patiently, and God turned to him and heard. "
                 "Your prayers are not lost in the waiting. Each one is heard by a God who bends down to listen.",
         question="What cry of your heart do you want God to hear today?",
         prayer="Lord, I'm waiting patiently for You. Thank You for hearing my cry."),
    dict(title="Delight Yourself", ref="Psalms 37:4",
         thought="When you delight in God, something beautiful happens: your desires begin to change and align with His. "
                 "He becomes the desire of your heart.",
         question="What does it look like for you to delight in God?",
         prayer="God, I want to delight in You. Shape the desires of my heart."),

    # Week 9 — Strength for Hard Days
    dict(title="Power to the Weak", ref="Isaiah 40:29",
         thought="God doesn't wait for you to be strong before He helps. He gives power to the weak. "
                 "Your weariness is not a disqualification; it's an invitation.",
         question="Where do you feel weak or weary today?",
         prayer="Lord, I'm tired. Please give me Your strength for today."),
    dict(title="Through Christ", ref="Philippians 4:13",
         thought="Paul wrote this from prison, after learning to be content in plenty and in need. "
                 "This verse isn't about achieving anything you want; it's about enduring anything with Christ's strength.",
         question="What are you facing that you need Christ's strength for?",
         prayer="Jesus, I can face today through You. Thank You for strengthening me."),
    dict(title="Near the Brokenhearted", ref="Psalms 34:18",
         thought="When your heart is broken, God doesn't keep His distance. He draws near. "
                 "You don't have to pretend to be okay with Him.",
         question="What is breaking your heart right now?",
         prayer="Lord, thank You for being near when I'm hurting. Hold my broken heart."),
    dict(title="Every Tear", ref="Revelation 21:4",
         thought="One day, God Himself will wipe away every tear. Pain, grief, and loss will be gone forever. "
                 "This hope doesn't erase today's tears, but it reminds you they won't last forever.",
         question="What sorrow are you looking forward to God healing?",
         prayer="Father, thank You for the promise of a day with no more tears. Give me hope until then."),
    dict(title="A Very Present Help", ref="Psalms 46:1",
         thought="God is not a distant help or an eventual help. He is a very present help, right here, right now, in this trouble. "
                 "Run to Him first.",
         question="What trouble do you need God's present help with?",
         prayer="God, You are my refuge and strength. Help me run to You first."),
    dict(title="Be Strong and Courageous", ref="Joshua 1:9",
         thought="Joshua was stepping into a role that felt far too big. God's answer was not, You can handle it, but I am with you. "
                 "Courage comes from His presence.",
         question="What feels too big for you right now?",
         prayer="Lord, give me courage. Thank You that You are with me wherever I go."),
    dict(title="Not Crushed", ref="2 Corinthians 4:8-9",
         thought="Pressed, but not crushed. Perplexed, but not in despair. Struck down, but not destroyed. "
                 "Hard days are real, but with God they are never the end of your story.",
         question="Where do you feel pressed right now? How has God kept you from being crushed?",
         prayer="God, I'm pressed but not crushed, because You are holding me."),

    # Week 10 — Loving Others Well
    dict(title="Love Is Patient", ref="1 Corinthians 13:4-5",
         thought="Read this passage and put your name in place of love. It's humbling. "
                 "None of us love perfectly, but God's love in you can grow patience and kindness you couldn't produce alone.",
         question="Which part of this description of love is hardest for you?",
         prayer="Lord, fill me with Your love. Make me patient and kind."),
    dict(title="As I Have Loved You", ref="John 13:34",
         thought="Jesus doesn't just say love one another. He says love one another as I have loved you: "
                 "sacrificially, patiently, and without keeping score.",
         question="How has Jesus loved you in a way you can show someone else?",
         prayer="Jesus, help me love others the way You have loved me."),
    dict(title="Carry Each Other", ref="Galatians 6:2",
         thought="Some burdens are too heavy to carry alone. God designed us to help carry each other's loads. "
                 "Sometimes that means helping; sometimes it means letting someone help you.",
         question="Whose burden could you help carry this week? Or who could help carry yours?",
         prayer="Lord, show me who needs help, and give me humility to accept help too."),
    dict(title="Words Like Honey", ref="Proverbs 16:24",
         thought="Your words have power to bring life. A kind text, a sincere compliment, an encouraging word "
                 "can be exactly what someone needs today.",
         question="Who could you encourage with your words today?",
         prayer="God, let my words be sweet and life-giving to everyone I talk to."),
    dict(title="Better Together", ref="Ecclesiastes 4:9-10",
         thought="Faith was never meant to be a solo journey. Friends who pray with you and for you are a gift from God. "
                 "If you don't have that yet, ask Him for it.",
         question="Who are the friends who help lift you up? Thank God for them by name.",
         prayer="Father, thank You for the people You've placed in my life. Bring me friends who love You."),
    dict(title="Pray for One Another", ref="James 5:16",
         thought="One of the most loving things you can do is pray for someone. "
                 "Your prayers for others are powerful and effective. Take time today to lift up the names on your heart.",
         question="Write the names of people you're praying for today.",
         prayer="Lord, I lift up the people I love to You. Meet each of them where they are."),
    dict(title="Peacemaker", ref="Romans 12:18",
         thought="You can't control how others respond, but you can control your part. "
                 "As much as it depends on you, choose peace: in your family, your friendships, and your online world.",
         question="Is there a relationship where you could take a step toward peace?",
         prayer="God, make me a peacemaker. Show me my part, and give me courage to do it."),

    # Week 11 — Purpose and Calling
    dict(title="Let Your Light Shine", ref="Matthew 5:16",
         thought="You don't have to be on a stage to shine. Ordinary kindness, honesty, and faithfulness "
                 "point people to God more than you know.",
         question="Where could your light shine more brightly this week?",
         prayer="Lord, let my life shine so others see You and give You glory."),
    dict(title="Whatever You Do", ref="Colossians 3:23",
         thought="Studying, working, caring for others, folding laundry. Every task becomes worship when you do it for God. "
                 "Nothing you do with a willing heart is too small for Him.",
         question="What everyday task could you offer to God as worship?",
         prayer="God, I offer my work to You today. Let me do it all for You."),
    dict(title="For Such a Time as This", ref="Esther 4:14",
         thought="Esther was a young woman placed in a position she never expected. God had a purpose for her right where she was. "
                 "He has placed you where you are for a reason too.",
         question="Why might God have placed you exactly where you are?",
         prayer="Lord, show me why You've placed me here, and give me courage to act."),
    dict(title="Your Gifts", ref="1 Peter 4:10",
         thought="God has given you gifts, not to keep for yourself, but to serve others. "
                 "Your creativity, compassion, organization, or listening ear are part of how He shows His grace to the world.",
         question="What gifts has God given you? How could you use one this week?",
         prayer="Father, thank You for my gifts. Show me how to use them to serve others."),
    dict(title="Seek First", ref="Matthew 6:33",
         thought="When God is first, everything else finds its proper place. "
                 "This daily prayer time is one way you're putting Him first. Keep it there, and trust Him with the rest.",
         question="What competes with God for first place in your life?",
         prayer="Lord, I want to seek You first. Help me trust You with everything else."),
    dict(title="A Lamp to My Feet", ref="Psalms 119:105",
         thought="A lamp doesn't light up the whole road, just the next step. "
                 "God may not show you your whole future, but His Word will light the step right in front of you.",
         question="What is the next step you need light for?",
         prayer="God, light my next step. I trust You with the rest of the path."),
    dict(title="Here I Am", ref="Isaiah 6:8",
         thought="Isaiah didn't know where he would be sent. He just said yes. "
                 "Being available to God is the beginning of every calling. Your willing heart matters more than your abilities.",
         question="What would it look like to say \"Here I am\" to God today?",
         prayer="Here I am, Lord. Send me. Use my life for Your purposes."),

    # Week 12 — Rest for Your Soul
    dict(title="My Soul Finds Rest", ref="Psalms 62:1-2",
         thought="Rest is not just sleep. It's the deep peace of trusting God as your rock. "
                 "When your security is in Him, you won't be greatly shaken.",
         question="Where are you looking for security besides God?",
         prayer="Lord, my soul rests in You alone. You are my rock and my fortress."),
    dict(title="Come Away and Rest", ref="Mark 6:31",
         thought="Jesus noticed when His friends were too busy to eat, and He invited them to rest. "
                 "He sees your busyness too, and He's inviting you to slow down.",
         question="What would real rest look like for you this week?",
         prayer="Jesus, I accept Your invitation to rest. Help me slow down with You."),
    dict(title="In Peace I Will Sleep", ref="Psalms 4:8",
         thought="Anxious thoughts often get loudest at night. Before you sleep tonight, "
                 "hand your worries to God and remember: He keeps you safe.",
         question="What keeps you up at night? Give it to God here.",
         prayer="Lord, tonight I will lie down in peace, because You keep me safe."),
    dict(title="The Shelter of the Most High", ref="Psalms 91:1-2",
         thought="To dwell means to live there, not just visit occasionally. "
                 "As prayer becomes part of your daily life, you're learning to live in God's shelter.",
         question="What helps you feel safe in God's presence?",
         prayer="God, You are my refuge and my fortress. I choose to dwell with You."),
    dict(title="The Better Part", ref="Luke 10:41-42",
         thought="Martha was busy serving Jesus; Mary was sitting with Him. Both loved Him, but Mary chose the better part. "
                 "Your time with God today is that better part.",
         question="Are you more like Martha or Mary right now?",
         prayer="Jesus, help me choose the better part. I want to sit with You."),
    dict(title="Renewed Day by Day", ref="2 Corinthians 4:16",
         thought="Your body gets tired, but your inner life can be renewed every single day. "
                 "That's what these daily moments with God are doing in you, quietly and steadily.",
         question="How have you been renewed over these weeks?",
         prayer="Lord, renew me today. Thank You for the quiet work You're doing in me."),
    dict(title="A Quiet Soul", ref="Psalms 131:2",
         thought="A weaned child doesn't come to her mother demanding; she comes simply to be close. "
                 "Today, come to God not with a list, but just to be with Him.",
         question="Spend a few minutes in silence. What did you notice?",
         prayer="Father, I quiet my soul before You. I just want to be with You."),

    # Week 13 — Hope That Lasts
    dict(title="A Living Hope", ref="1 Peter 1:3",
         thought="Your hope is not wishful thinking. It's a living hope, rooted in the resurrection of Jesus. "
                 "Because He lives, there is always hope.",
         question="Where do you need a fresh dose of hope?",
         prayer="God, thank You for a living hope through Jesus. Let it fill my heart today."),
    dict(title="The God of Hope", ref="Romans 15:13",
         thought="God is not just the giver of hope; He is the God of hope. "
                 "Ask Him to fill you so full of joy and peace that hope overflows to everyone around you.",
         question="Who in your life needs some of your overflowing hope?",
         prayer="God of hope, fill me with joy and peace. Let hope overflow from my life."),
    dict(title="He Will Finish It", ref="Philippians 1:6",
         thought="God started a good work in you, and He is not going to abandon it halfway. "
                 "Even on the days you feel stuck, He is still working.",
         question="What good work have you seen God begin in you during this journal?",
         prayer="Lord, thank You for not giving up on me. Finish the good work You started."),
    dict(title="Faithful to the Skies", ref="Psalms 36:5",
         thought="Look up today. God's faithfulness stretches farther than you can see. "
                 "Over these weeks, He has been faithful every single day, including the days you missed.",
         question="How has God been faithful to you during these 90 days?",
         prayer="Lord, Your faithfulness reaches the skies. Thank You for never failing me."),
    dict(title="Press On", ref="Philippians 3:13-14",
         thought="Forget what's behind: the missed days, the distracted prayers, the doubts. "
                 "Look ahead. The goal is not perfection; it's pressing on toward Jesus.",
         question="What do you want to leave behind as you press on?",
         prayer="Jesus, I'm leaving the past behind and pressing on toward You."),
    dict(title="Keep Going", ref="Galatians 6:9",
         thought="You made it to Day 90. This isn't the finish line; it's a new beginning. "
                 "The habit you've built is a gift to carry forward. Don't give up. The harvest is coming.",
         question="What will you do to keep praying after this journal ends?",
         prayer="Lord, thank You for these 90 days. Help me keep going and never give up."),
]

from content.typography import smart

WEEKS = [(smart(a), smart(b)) for a, b in WEEKS]
PARTS = [(n, a, b, c, smart(t)) for n, a, b, c, t in PARTS]
DAYS = [{k: (v if k == "ref" else smart(v)) for k, v in d.items()} for d in DAYS]

assert len(DAYS) == 90 and len(WEEKS) == 13
