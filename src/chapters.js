export const CHAPTERS = [
  { id: 'residence', name: 'The Solstice Villa', start: 0, end: .095, nav: 0, still: 1 },
  { id: 'outdoors', name: 'Outdoor Tranquility', start: .10, end: .27, nav: .125, still: 45 },
  { id: 'living', name: 'Light-filled Interiors', start: .285, end: .46, nav: .36, still: 135 },
  { id: 'dining', name: 'The Culinary Salon', start: .505, end: .635, nav: .575, still: 201 },
  { id: 'stairs', name: 'The Floating Staircase', start: .645, end: .84, nav: .72, still: 251 },
  { id: 'suite', name: 'The Private Balcony', start: .85, end: 1, nav: .94, still: 329 },
];
export function chapterFromProgress(progress) {
  return Math.max(0, CHAPTERS.findLastIndex(chapter => progress >= chapter.start));
}

export const nextChapterDestination = index => CHAPTERS[index + 1]?.id || 'visit';
