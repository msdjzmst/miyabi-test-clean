
/**
 * Sample function for testing
 * @param name - The name parameter
 * @param age - The age parameter
 * @returns A greeting message
 */
export function greet(name: string, age: number): string {
  return `Hello, ${name}! You are ${age} years old.`;
}

/**
 * Sample class for testing
 */
export class Calculator {
  /**
   * Adds two numbers
   * @param a - First number
   * @param b - Second number
   * @returns The sum
   */
  public add(a: number, b: number): number {
    return a + b;
  }

  /**
   * Private helper method
   */
  private helper(): void {
    // Do nothing
  }
}

/**
 * Sample interface for testing
 */
export interface User {
  /** User name */
  name: string;
  /** User age */
  age: number;
  /** Optional email */
  email?: string;
}
