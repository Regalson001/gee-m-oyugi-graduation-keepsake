
const express = require('express');
const Parser = require('rss-parser');
const path = require('path');

const app = express();
const parser = new Parser({
  timeout: 12000,
  headers: {
    'User-Agent': 'PressSphere/1.0'
  }
});

const PORT = process.env.PORT || 3000;
const cache = new Map();
const CACHE_DURATION = 3 * 60 * 1000;

const countries = {
  US: 'US:en',
  GB: 'GB:en',
  KE: 'KE:en',
  IN: 'IN:en',
  CA: 'CA:en',
  AU: 'AU:en',
  ZA: 'ZA:en'
};

app.use(express.static(path.join(__dirname)));

app.get('/api/news', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 150);
  const country = String(req.query.country || '').toUpperCase();
  const category = String(req.query.category || '').trim().slice(0, 50);

  const searchTerm = [q, category].filter(Boolean).join(' ');
  const query = searchTerm || 'latest world news';

  const region = countries[country] || 'US:en';
  const cacheKey = `${query}-${region}`;

  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.time < CACHE_DURATION) {
    return res.json({
      articles: cached.articles,
      cached: true
    });
  }

  try {
    const url = new URL('https://news.google.com/rss/search');
    url.searchParams.set('q', query);
    url.searchParams.set('hl', 'en');
    url.searchParams.set('gl', region.split(':')[0]);
    url.searchParams.set('ceid', region);

    const feed = await parser.parseURL(url.toString());

    const articles = feed.items.slice(0, 30).map(item => ({
      title: item.title || 'Untitled story',
      link: item.link || '#',
      description: (item.contentSnippet || item.content || '')
        .replace(/<[^>]*>/g, '')
        .slice(0, 240),
      source: item.creator || feed.title || 'Google News',
      category: category || 'Global News',
      publishedAt: item.isoDate || item.pubDate || ''
    }));

    cache.set(cacheKey, {
      time: Date.now(),
      articles
    });

    res.json({ articles, cached: false });

  } catch (error) {
    console.error('News retrieval error:', error.message);
    res.status(502).json({
      error: 'News service is temporarily unavailable.',
      articles: []
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    application: 'PressSphere'
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PressSphere running at http://localhost:${PORT}`);
});
