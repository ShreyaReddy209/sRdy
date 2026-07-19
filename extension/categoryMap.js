const DOMAIN_CATEGORIES = {
  // Social media
  'instagram.com': 'social_media',
  'facebook.com': 'social_media',
  'fb.com': 'social_media',
  'twitter.com': 'social_media',
  'x.com': 'social_media',
  'tiktok.com': 'social_media',
  'reddit.com': 'social_media',
  'snapchat.com': 'social_media',
  'pinterest.com': 'social_media',
  'threads.net': 'social_media',
  'linkedin.com': 'social_media',
  'quora.com': 'social_media',
  'tumblr.com': 'social_media',
  'mastodon.social': 'social_media',
  'bsky.app': 'social_media',

  // Video / audio streaming
  'youtube.com': 'video_streaming',
  'youtu.be': 'video_streaming',
  'netflix.com': 'video_streaming',
  'primevideo.com': 'video_streaming',
  'hotstar.com': 'video_streaming',
  'jiocinema.com': 'video_streaming',
  'twitch.tv': 'video_streaming',
  'hulu.com': 'video_streaming',
  'disneyplus.com': 'video_streaming',
  'spotify.com': 'video_streaming',
  'soundcloud.com': 'video_streaming',
  'vimeo.com': 'video_streaming',
  'dailymotion.com': 'video_streaming',
  'crunchyroll.com': 'video_streaming',

  // Gaming
  'steampowered.com': 'gaming',
  'steamcommunity.com': 'gaming',
  'epicgames.com': 'gaming',
  'roblox.com': 'gaming',
  'miniclip.com': 'gaming',
  'chess.com': 'gaming',
  'ea.com': 'gaming',
  'ubisoft.com': 'gaming',
  'poki.com': 'gaming',
  'itch.io': 'gaming',

  // Productivity / dev tools / AI assistants
  'notion.so': 'productivity',
  'docs.google.com': 'productivity',
  'sheets.google.com': 'productivity',
  'slides.google.com': 'productivity',
  'drive.google.com': 'productivity',
  'calendar.google.com': 'productivity',
  'trello.com': 'productivity',
  'asana.com': 'productivity',
  'todoist.com': 'productivity',
  'github.com': 'productivity',
  'gitlab.com': 'productivity',
  'bitbucket.org': 'productivity',
  'figma.com': 'productivity',
  'canva.com': 'productivity',
  'atlassian.com': 'productivity',
  'jira.com': 'productivity',
  'confluence.com': 'productivity',
  'office.com': 'productivity',
  'sharepoint.com': 'productivity',
  'onedrive.live.com': 'productivity',
  'dropbox.com': 'productivity',
  'chatgpt.com': 'productivity',
  'chat.openai.com': 'productivity',
  'claude.ai': 'productivity',
  'gemini.google.com': 'productivity',
  'perplexity.ai': 'productivity',
  'cursor.com': 'productivity',
  'vercel.com': 'productivity',
  'firebase.google.com': 'productivity',
  'console.firebase.google.com': 'productivity',
  'console.cloud.google.com': 'productivity',
  'localhost': 'productivity',
  '127.0.0.1': 'productivity',

  // Education
  'coursera.org': 'education',
  'udemy.com': 'education',
  'khanacademy.org': 'education',
  'edx.org': 'education',
  'geeksforgeeks.org': 'education',
  'w3schools.com': 'education',
  'leetcode.com': 'education',
  'hackerrank.com': 'education',
  'freecodecamp.org': 'education',
  'wikipedia.org': 'education',
  'stackoverflow.com': 'education',
  'stackexchange.com': 'education',
  'medium.com': 'education',
  'developer.mozilla.org': 'education',

  // News
  'cnn.com': 'news',
  'bbc.com': 'news',
  'nytimes.com': 'news',
  'theguardian.com': 'news',
  'reuters.com': 'news',
  'timesofindia.indiatimes.com': 'news',
  'hindustantimes.com': 'news',
  'livemint.com': 'news',
  'ndtv.com': 'news',
  'indianexpress.com': 'news',
  'news.google.com': 'news',

  // Shopping
  'amazon.com': 'shopping',
  'amazon.in': 'shopping',
  'flipkart.com': 'shopping',
  'ebay.com': 'shopping',
  'myntra.com': 'shopping',
  'ajio.com': 'shopping',
  'meesho.com': 'shopping',
  'etsy.com': 'shopping',

  // Communication
  'mail.google.com': 'communication',
  'gmail.com': 'communication',
  'outlook.com': 'communication',
  'outlook.office.com': 'communication',
  'web.whatsapp.com': 'communication',
  'slack.com': 'communication',
  'discord.com': 'communication',
  'teams.microsoft.com': 'communication',
  'zoom.us': 'communication',
  'meet.google.com': 'communication',
  'telegram.org': 'communication',
  'web.telegram.org': 'communication',
  'messenger.com': 'communication',
}

/** Substring hints on the hostname itself — used only when no exact/parent-domain match is found. */
const KEYWORD_HINTS = [
  { match: ['video', 'stream', 'movie', 'anime', 'watch'], category: 'video_streaming' },
  { match: ['game', 'gaming', 'arcade'], category: 'gaming' },
  { match: ['shop', 'store', 'cart', 'deal'], category: 'shopping' },
  { match: ['news', 'times', 'herald', 'tribune', 'post'], category: 'news' },
  { match: ['mail', 'chat', 'messenger'], category: 'communication' },
  { match: ['learn', 'academy', 'course', 'university', 'tutorial'], category: 'education' },
  { match: ['docs', 'drive', 'office', 'workspace', 'cloud', 'dev', 'code'], category: 'productivity' },
  { match: ['social', 'forum', 'community'], category: 'social_media' },
]

/** Matches exact host, then progressively shorter parent domains (e.g. mail.google.com -> google.com) */
export function categorizeDomain(hostname) {
  if (!hostname) return 'other'
  const host = hostname.toLowerCase()
  if (DOMAIN_CATEGORIES[host]) return DOMAIN_CATEGORIES[host]

  const parts = host.split('.')
  for (let i = 1; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.')
    if (DOMAIN_CATEGORIES[candidate]) return DOMAIN_CATEGORIES[candidate]
  }

  for (const { match, category } of KEYWORD_HINTS) {
    if (match.some((kw) => host.includes(kw))) return category
  }

  return 'other'
}

export { DOMAIN_CATEGORIES }
