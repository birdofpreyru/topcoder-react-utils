import Link from 'components/Link';
import React from 'react';
import { shallowSnapshot } from 'utils/jest';

test('Matches snapshots', () => {
  shallowSnapshot(<Link />); // eslint-disable-line jsx-a11y/anchor-is-valid
});
