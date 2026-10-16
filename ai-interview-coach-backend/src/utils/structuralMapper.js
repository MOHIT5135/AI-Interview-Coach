function mapFlatArrayToNestedObjects(flatArray) {
  if (!Array.isArray(flatArray) || flatArray.length === 0) return [];
  const nestedItems = [];
  let currentItem = null;

  flatArray.forEach(line => {
    const trimmed = String(line || '').trim();
    if (!trimmed) return;

    const isBullet = /^[•\-\*•]/.test(trimmed) || (currentItem && trimmed.length > 30 && !/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20)/i.test(trimmed));

    if (isBullet) {
      if (!currentItem) {
         currentItem = { title: 'Experience', company: '', date: '', bullets: [] };
         nestedItems.push(currentItem);
      }
      currentItem.bullets.push(trimmed.replace(/^[•\-\*•]\s*/, '').trim());
    } else {
      if (currentItem && currentItem.bullets.length === 0) {
         // Accumulate sub-headers (Dates or extra company info)
         if (/(19|20)\d{2}/.test(trimmed) || /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(trimmed)) {
            currentItem.date = trimmed;
         } else {
            currentItem.company += (currentItem.company ? ' | ' : '') + trimmed;
         }
      } else {
        const parts = trimmed.split(/—|-/).map(s => s.trim());
        currentItem = { title: parts[0] || trimmed, company: parts[1] || '', date: '', bullets: [] };
        nestedItems.push(currentItem);
      }
    }
  });
  return nestedItems;
}

function mapProjectsFlatArrayToNested(flatArray) {
  if (!Array.isArray(flatArray) || flatArray.length === 0) return [];
  const nestedItems = [];
  let currentItem = null;

  flatArray.forEach(line => {
    const trimmed = String(line || '').trim();
    if (!trimmed) return;
    const isBullet = /^[•\-\*•]/.test(trimmed);

    if (isBullet) {
      if (!currentItem) {
         currentItem = { name: 'Project', date: '', bullets: [] };
         nestedItems.push(currentItem);
      }
      currentItem.bullets.push(trimmed.replace(/^[•\-\*•]\s*/, '').trim());
    } else {
      if (currentItem && currentItem.bullets.length === 0) {
         // Accumulate sub-headers (Dates or Tech Stack)
         if (/(19|20)\d{2}/.test(trimmed) || /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(trimmed)) {
            currentItem.date = trimmed;
         } else {
            currentItem.name += ` | ${trimmed}`;
         }
      } else {
        currentItem = { name: trimmed, link: '', date: '', bullets: [] };
        nestedItems.push(currentItem);
      }
    }
  });
  return nestedItems;
}

module.exports = { mapFlatArrayToNestedObjects, mapProjectsFlatArrayToNested };
