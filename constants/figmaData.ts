// Demo data mirrored from the Figma prototype, translated to Hungarian.
export const MEDS = [
  { id: 'm1', name: 'Mesalamine', dose: '800mg', times: '3× naponta', time: '8:00' },
  { id: 'm2', name: 'Azathioprine', dose: '100mg', times: '1× naponta', time: '8:00' },
  { id: 'm3', name: 'Probiotikum', dose: '10Mrd CFU', times: '1× naponta', time: '21:00' },
  { id: 'm4', name: 'D3-vitamin', dose: '2000 NE', times: '1× naponta', time: '8:00' },
] as const;

export const APPOINTMENTS = [
  {
    id: 'a1',
    who: 'Dr. Kim Sarah',
    sub: 'Gasztroenterológia',
    date: 'aug. 20.',
    time: '10:30',
  },
  {
    id: 'a2',
    who: 'Vérvétel',
    sub: 'CBC · CRP · Kalprotektin',
    date: 'aug. 16.',
    time: '8:00',
  },
] as const;

export const RECIPES = [
  {
    name: 'Sült lazac fehér rizzsel',
    tags: ['Magas fehérje', 'Fellángolás-barát'],
    time: '25 perc',
    cal: 420,
  },
  {
    name: 'Banános zab smoothie',
    tags: ['Egyszerű', 'Bélbarát'],
    time: '5 perc',
    cal: 310,
  },
  {
    name: 'Párolt csirke cukkinivel',
    tags: ['Alacsony rost', 'Gyulladáscsökk.'],
    time: '20 perc',
    cal: 380,
  },
  {
    name: 'Buggyantott tojásos rizstál',
    tags: ['Kíméletes', 'Magas fehérje'],
    time: '15 perc',
    cal: 355,
  },
] as const;

export const CHART_DATA = [
  { date: 'júl. 14.', severity: 2, crp: 2.8 },
  { date: 'júl. 17.', severity: 5, crp: 8.2 },
  { date: 'júl. 20.', severity: 6, crp: 11.5 },
  { date: 'júl. 23.', severity: 4, crp: 7.1 },
  { date: 'júl. 26.', severity: 3, crp: 5.4 },
  { date: 'júl. 29.', severity: 2, crp: 3.9 },
  { date: 'aug. 1.', severity: 1, crp: 2.1 },
  { date: 'aug. 4.', severity: 2, crp: 2.5 },
  { date: 'aug. 7.', severity: 3, crp: 4.2 },
  { date: 'aug. 10.', severity: 2, crp: 3.1 },
  { date: 'aug. 13.', severity: 1, crp: 1.8 },
] as const;

export const WEEK = [
  { day: 'H', date: 10 },
  { day: 'K', date: 11 },
  { day: 'Sze', date: 12 },
  { day: 'Cs', date: 13, today: true },
  { day: 'P', date: 14 },
  { day: 'Szo', date: 15 },
  { day: 'V', date: 16 },
] as const;
