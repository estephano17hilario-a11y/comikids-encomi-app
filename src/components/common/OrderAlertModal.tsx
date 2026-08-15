import React from 'react';

interface Props {
  onViewOrder?: () => void;
}

export const OrderAlertModal: React.FC<Props> = () => {
  // Desactivado: el usuario no desea el modal neon en pantalla al abrir la app
  return null;
};

