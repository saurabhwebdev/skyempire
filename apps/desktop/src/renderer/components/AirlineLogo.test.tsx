// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AirlineLogo } from './AirlineLogo';

describe('AirlineLogo', () => {
  it('falls back to a badge with the code when no logo file exists', () => {
    render(<AirlineLogo code="EK" name="Emirates" color="#D71921" size={24} />);
    const img = screen.getByRole('img', { name: 'Emirates' });
    fireEvent.error(img);
    expect(screen.getByRole('img', { name: 'Emirates' })).toHaveTextContent('EK');
  });
});
