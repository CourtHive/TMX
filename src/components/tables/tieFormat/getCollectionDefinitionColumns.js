export function getCollectionDefinitionColumns() {
  return [
    {
      field: 'collectionName',
      title: 'Name'
    },
    {
      field: 'matchUpCount',
      title: 'Matches'
    },
    {
      field: 'matchUpType',
      title: 'Type'
    },
    {
      title: 'Category',
      field: 'category'
    },
    {
      title: 'Gender',
      field: 'gender'
    },
    {
      title: 'Score format',
      field: 'matchUpFormat'
    },
    {
      title: 'Award type',
      field: 'awardType'
    },
    {
      title: 'Award value',
      field: 'awardValue'
    }
  ];
}
