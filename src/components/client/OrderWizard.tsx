import React from 'react';
import { OrganicOrderFlow } from './OrganicOrderFlow';

interface Props {
  onSuccess?: () => void;
}

export const OrderWizard: React.FC<Props> = ({ onSuccess }) => {
  return <OrganicOrderFlow onSuccess={onSuccess} />;
};
