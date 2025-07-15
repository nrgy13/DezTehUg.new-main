// Тестовый файл для проверки работы GitHub Copilot
// Попробуйте написать комментарий и нажать Tab для автодополнения

import React from 'react';

// TODO: Создать компонент кнопки с анимацией hover эффекта
interface ButtonProps {
  title: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

// Функция для создания cyberpunk кнопки
export const CopilotTestButton: React.FC<ButtonProps> = ({ 
  title, 
  onClick, 
  variant = 'primary',
  disabled = false 
}) => {
  // Добавьте здесь логику компонента
  // Copilot должен предложить автодополнение
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-6 py-3 rounded-lg font-semibold transition-all duration-300
        ${variant === 'primary' 
          ? 'bg-cyan-500 hover:bg-cyan-400 text-black' 
          : 'bg-gray-800 hover:bg-gray-700 text-cyan-400'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
        border border-cyan-400 hover:border-cyan-300
        shadow-lg hover:shadow-cyan-400/50
      `}
    >
      {title}
    </button>
  );
};

// TODO: Создать хук для управления состоянием модального окна
// Copilot должен предложить реализацию хука

// TODO: Создать утилитарную функцию для форматирования цены
// Например: formatPrice(1000) => "1 000 ₽"

export default CopilotTestButton;