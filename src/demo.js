// Sample business shown on first run, so the app is never empty. Bhatia Garments is fictional.
function demoData(today = new Date()) {
  const { pad, daysIn, weekday } = Pay;
  const ymOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const thisYm = ymOf(today);
  const lastYm = ymOf(new Date(today.getFullYear(), today.getMonth() - 1, 1));

  const people = [
    ['Harjit Singh', 'Floor supervisor', 'monthly', 28000],
    ['Ramesh Yadav', 'Cutting master', 'monthly', 24000],
    ['Gurpreet Kaur', 'Tailor', 'monthly', 16000],
    ['Mohd. Arif', 'Tailor', 'monthly', 15500],
    ['Sunita Devi', 'Tailor', 'monthly', 15000],
    ['Salma Bano', 'Embroidery', 'monthly', 17000],
    ['Anjali Verma', 'Accounts', 'monthly', 18000],
    ['Deepak Gill', 'Machine mechanic', 'monthly', 22000],
    ['Pooja Rani', 'Thread cutting', 'daily', 520],
    ['Rajesh Kumar', 'Ironing', 'daily', 560],
    ['Vikas Thakur', 'Packing', 'daily', 520],
    ['Kamla', 'Helper', 'daily', 480],
  ];
  const staff = people.map(([name, role, payType, rate], i) => ({
    id: 's' + (i + 1), name, role, payType, rate, weeklyOff: 0,
    joined: i === 7 ? `${thisYm}-12` : '2024-04-01', phone: '', active: true,
  }));

  // Small seeded random, so the sample looks the same on every machine.
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const attendance = {};
  for (const ym of [lastYm, thisYm]) {
    const upto = ym === thisYm ? today.getDate() - 1 : daysIn(ym);
    attendance[ym] = {};
    for (const s of staff) {
      const marks = attendance[ym][s.id] = {};
      for (let d = 1; d <= upto; d++) {
        if (`${ym}-${pad(d)}` < s.joined || weekday(ym, d) === s.weeklyOff) continue;
        const r = rand();
        marks[d] = r < 0.05 ? 'A' : r < 0.08 ? 'H' : r < 0.1 ? 'L' : 'P';
      }
    }
  }

  const advances = [
    { id: 'a1', staffId: 's4', date: `${lastYm}-08`, amount: 3000, note: 'School fees' },
    { id: 'a2', staffId: 's10', date: `${lastYm}-19`, amount: 1500, note: '' },
    { id: 'a3', staffId: 's3', date: `${thisYm}-03`, amount: 2000, note: 'Festival' },
    { id: 'a4', staffId: 's12', date: `${thisYm}-06`, amount: 1000, note: '' },
    { id: 'a5', staffId: 's2', date: `${thisYm}-10`, amount: 5000, note: 'Medical' },
  ];

  return {
    settings: { business: 'Bhatia Garments', address: 'Focal Point, Phase 8, Ludhiana' },
    staff, attendance, advances,
  };
}
