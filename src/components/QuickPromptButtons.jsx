import React from 'react';
import './QuickPromptButtons.css';

const QuickPromptButtons = ({ onSelectPrompt }) => {
  // Define common prompts that users might want to use
  const prompts = [
    {
      label: 'How to install...',
      template: 'How do I install part number '
    },
    {
      label: 'Check compatibility',
      template: 'Is part number compatible with my model '
    },
    {
      label: 'Find part for symptom',
      template: 'My refrigerator has a problem with '
    },
    {
      label: 'Price check',
      template: 'How much does part number cost?'
    },
    {
      label: 'Installation difficulty',
      template: 'How difficult is it to install part number '
    },
    {
      label: 'Repair guide',
      template: 'How do I fix a '
    }
  ];

  return (
    <div className="quick-prompts-container">
      <div className="quick-prompts-label">Need something quick?</div>
      <div className="quick-prompts">
        {prompts.map((prompt, index) => (
          <button
            key={index}
            className="quick-prompt-button"
            onClick={() => onSelectPrompt(prompt.template)}
            aria-label={`Use prompt template: ${prompt.label}`}
          >
            {prompt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickPromptButtons;