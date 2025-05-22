import { AxiosError } from 'axios';
import { ValidationError } from 'yup';

/**
 * Custom error class to represent errors related to missing or invalid credentials.
 * This helps in distinguishing credential-specific issues from other types of errors.
 */
export class CredentialsError extends Error {
  /**
   * Constructs a new CredentialsError.
   * @param message - The error message.
   */
  constructor(message: string) {
    super(message);
    this.name = "CredentialsError";
  }
}

/**
 * A union type representing known error types that can occur within the application.
 * This includes validation errors, HTTP errors from Axios, custom credential errors,
 * and the generic Error type as a fallback for other unexpected errors.
 */
export type KnownError = ValidationError | AxiosError | CredentialsError | Error;
