import { AxiosError } from 'axios';

/**
 * Type guard to check if an unknown error object is an AxiosError.
 *
 * This function verifies if the provided error object:
 * 1. Is an object and not null.
 * 2. Has the `isAxiosError` property set to `true`.
 *
 * While Axios errors typically also have `response` and `config` properties,
 * checking `isAxiosError` is the most direct and reliable method provided by Axios.
 *
 * @param error - The error object to check.
 * @returns `true` if the error is an AxiosError, `false` otherwise.
 */
export function isAxiosErr(error: unknown): error is AxiosError {
  if (typeof error === 'object' && error !== null) {
    // The `isAxiosError` property is the most reliable check.
    return (error as AxiosError).isAxiosError === true;
  }
  return false;
}
