/**
 * Auxiliary functions for <Dropdown> component.
 */

import { findIndex, findLastIndex } from 'lodash';

/**
 * Returns option name and value as two elements of array.
 * @param {object|string} option
 * @return {string[]}
 */
export function optionNameValue(option) {
  return typeof option === 'string'
    ? [option, option] : [option.name, option.value];
}

/**
 * Returns option value.
 * @param {object|string} option Option object or string.
 * @return {string}
 */
export function optionName(option) {
  if (typeof option === 'string') return option;
  return option.name === undefined ? option.value : option.name;
}

/**
 * Returns option value.
 * @param {object|string} option Option object or string.
 * @return {string}
 */
export function optionValue(option) {
  return typeof option === 'string' ? option : option.value;
}

/**
 * Finds the option by value.
 * @param {string} value Option value.
 * @param {array} options Options array.
 * @param {function} [filter] Optional. Filter function.
 * @return {number} Index of the matching option, or -1.
 */
function findOptionIndex(value, options, filter) {
  return options.findIndex(
    (item) => optionValue(item) === value && (!filter || filter(item)),
  );
}

/**
 * Finds the next option index.
 * @param {string} value Current value.
 * @param {array} options Option array.
 * @param {function} [filter] Optional. Filter function.
 * @return {number} Next option index, or -1.
 */
export function findNextOptionIndex(value, options, filter) {
  let index = findOptionIndex(value, options, filter);
  if (index >= 0 && ++index < options.length) {
    return filter ? findIndex(options, filter, index) : index;
  }
  return -1;
}

/**
 * Finds the next option by name.
 * @param {string} search Search query.
 * @param {array} options Options.
 * @param {string} value Current option value.
 * @param {function} [filter] Optional. Options filter.
 * @return {null|string} Found option value, or null.
 */
export function searchOption(search, options, value, filter) {
  let startIndex = findOptionIndex(value, options, filter);
  if (search.length === 1) ++startIndex;
  if (startIndex < 0 || startIndex === options.length) startIndex = 0;
  const lookup = (item) => optionName(item).startsWith(search)
    && (!filter || filter(item));

  let index = findIndex(options, lookup, startIndex);
  if (index < 0 && startIndex > 0) index = findIndex(options, lookup);
  return index;
}

/**
 * Finds the previous option index.
 * @param {string} value Current value.
 * @param {array} options Option array.
 * @param {function} [filter] Optional. Filter function.
 * @return {number} Previous option index, or -1.
 */
export function findPrevOptionIndex(value, options, filter) {
  let index = findOptionIndex(value, options, filter) - 1;
  if (index >= 0 && filter) index = findLastIndex(options, filter, index);
  return index >= 0 ? index : -1;
}

/**
 * Returns true if key is a text input character (letter, symbol, ...).
 * @param {string} key
 * @return {boolean}
 */
export function isSymbolKey(key) {
  return key.match(/^(\s|\w)$/);
}
