import React from 'react';

export const Bidi: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <bdi dir="auto">{children}</bdi>
);

export default Bidi;
