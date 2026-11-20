import { eventGovernor } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import {
  describeCategory,
  editorCategoryType,
  referencingEvents,
  undefinedEventCategories,
} from './categoryDefinition';

// renders the key and its values, so a test reads which sentence was chosen and with what
const t = (key: string, values?: Record<string, any>) =>
  `${key.split('.').pop()}${values ? JSON.stringify(values) : ''}`;
const getAgeDetails = (args: any) => eventGovernor.getCategoryAgeDetails(args);
const describeAt = (category: any) => describeCategory(category, { consideredDate: '2026-11-20', getAgeDetails, t });

describe('describeCategory', () => {
  it('states an under-N code as the age it allows at most, with the birth date that decides it', () => {
    let result: any = describeAt({ categoryName: 'U18', ageCategoryCode: 'U18' });
    expect(result).toEqual(['ageAtMost{"max":17,"date":"2026-11-20","born":"2008-11-21"}']);

    // N-and-under allows N itself
    result = describeAt({ categoryName: '18 & Under', ageCategoryCode: '18U' });
    expect(result).toEqual(['ageAtMost{"max":18,"date":"2026-11-20","born":"2007-11-21"}']);
  });

  it('states an N-and-over code as the age it requires at least', () => {
    const result = describeAt({ categoryName: 'Open 35+', ageCategoryCode: '35O' });
    expect(result[0]).toMatch(/^ageAtLeast\{"min":35,/);
  });

  it('states a rating band, and a rating with no bounds', () => {
    expect(describeAt({ categoryName: 'DUPR 3.0-4.49', ratingType: 'DUPR', ratingMin: 3, ratingMax: 4.49 })).toEqual([
      'ratingBetween{"ratingType":"DUPR","min":3,"max":4.49}',
    ]);
    expect(describeAt({ categoryName: 'WTN', ratingType: 'WTN' })).toEqual(['ratingAny{"ratingType":"WTN"}']);
  });

  it('says a category with a name and no rule restricts nobody', () => {
    // CourtHive Challenge's "U18" was exactly this: a name, no code
    expect(describeAt({ categoryName: 'U18' })).toEqual(['noRule']);
    expect(describeAt({ categoryName: 'Placeholder', ageCategoryCode: '-' })).toEqual(['noRule']);
  });
});

describe('the events using a category', () => {
  const U18_DOUBLES = 'U18 Boys Doubles';
  const events = [
    { eventName: U18_DOUBLES, category: { categoryName: 'U18' } },
    { eventName: 'U16 Girls Singles', category: { categoryName: 'U16', ageCategoryCode: 'U16' } },
    { eventName: 'Open', category: undefined },
  ];

  it('matches an event to a tournament category by code or by name', () => {
    expect(referencingEvents({ categoryName: 'Under 16', ageCategoryCode: 'U16' }, events)).toEqual([
      'U16 Girls Singles',
    ]);
    expect(referencingEvents({ categoryName: 'U18', ageCategoryCode: 'U18' }, events)).toEqual([U18_DOUBLES]);
  });

  it('lists event categories the tournament does not define, with their events', () => {
    const result = undefinedEventCategories([{ categoryName: 'Under 16', ageCategoryCode: 'U16' }], events);
    expect(result).toEqual([{ category: { categoryName: 'U18' }, usedBy: [U18_DOUBLES] }]);
    expect(undefinedEventCategories([], [{ eventName: 'No category' }])).toEqual([]);
  });
});

describe('editorCategoryType', () => {
  it('opens the editor on the section a category uses, when it did not record one itself', () => {
    expect(editorCategoryType({ ageCategoryCode: 'U18' })).toEqual('AGE');
    expect(editorCategoryType({ ratingType: 'DUPR', ratingMin: 3 })).toEqual('RATING');
    expect(editorCategoryType({ ageCategoryCode: 'U18', ratingType: 'WTN' })).toEqual('BOTH');
    expect(editorCategoryType({ type: 'RATING', ageCategoryCode: 'U18' })).toEqual('RATING');
    expect(editorCategoryType({ categoryName: 'U18' })).toBeUndefined();
  });
});
