const BASE   = 'appk6C18dNxzJvss7';
const LEADS  = 'tblco5qGhwJ7zePbo';
const VISITS = 'tblpMxC5UeXyQuU5E';

async function fetchAll(pat, tableId) {
  const records = [];
  let offset = '';
  do {
    const url = `https://api.airtable.com/v0/${BASE}/${tableId}?pageSize=100${offset ? '&offset=' + offset : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
    const json = await res.json();
    records.push(...(json.records || []));
    offset = json.offset || '';
  } while (offset);
  return records;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) return res.status(500).json({ error: 'No AIRTABLE_PAT' });

  const [leadRecs, visitRecs] = await Promise.all([
    fetchAll(pat, LEADS),
    fetchAll(pat, VISITS),
  ]);

  // ── Process leads ──
  const leads = leadRecs.map(r => {
    const f = r.fields;
    return {
      id:            r.id,
      ownerName:     f['Owner Name']     || '',
      dogName:       f['Dog Name']       || '',
      phone:         f['WhatsApp']       || '',
      age:           f['Age']            || '',
      weight:        f['Weight (kg)']    || '',
      activityLevel: f['Activity Level'] || '',
      outlet:        (typeof f['Outlet'] === 'object' ? f['Outlet'].name : (f['Outlet'] || 'Unknown')).replace(/\b\w/g, c => c.toUpperCase()),
      source:        f['Source']         || '',
      submittedAt:   f['Submitted At']   || r.createdTime,
    };
  });

  // ── Process visits ──
  const visits = visitRecs.map(r => {
    const f = r.fields;
    return {
      timestamp: f['Timestamp'] || r.createdTime,
      outlet:    f['Outlet']    || 'Unknown',
      source:    f['Source']    || '',
      date:      f['Date']      || (r.createdTime || '').slice(0, 10),
    };
  });

  // ── Outlet breakdown (leads) ──
  const outletMap = {};
  leads.forEach(l => {
    const o = l.outlet || 'Unknown';
    outletMap[o] = (outletMap[o] || 0) + 1;
  });

  // ── Leads by date ──
  const leadsByDate = {};
  leads.forEach(l => {
    const d = (l.submittedAt || '').slice(0, 10);
    if (d) leadsByDate[d] = (leadsByDate[d] || 0) + 1;
  });

  // ── Visits by date ──
  const visitsByDate = {};
  visits.forEach(v => {
    const d = v.date || (v.timestamp || '').slice(0, 10);
    if (d) visitsByDate[d] = (visitsByDate[d] || 0) + 1;
  });

  // ── Leads by hour ──
  const byHour = Array(24).fill(0);
  leads.forEach(l => {
    const h = new Date(l.submittedAt).getUTCHours();
    if (!isNaN(h)) byHour[h]++;
  });

  // ── Activity level breakdown ──
  const activityMap = {};
  leads.forEach(l => {
    const a = l.activityLevel || 'Not specified';
    activityMap[a] = (activityMap[a] || 0) + 1;
  });

  return res.status(200).json({
    leads:         leads.slice(-20).reverse(), // last 20, newest first
    allLeads:      leads,   // full set — enables client-side date-range filtering
    allVisits:     visits,  // full set — enables client-side date-range filtering
    totalLeads:    leads.length,
    totalVisits:   visits.length,
    outletMap,
    leadsByDate,
    visitsByDate,
    byHour,
    activityMap,
  });
}
