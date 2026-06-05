import React, { useRef, useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, className }) => {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (contentEditableRef.current && contentEditableRef.current.innerHTML !== value) {
      if (!value) {
        contentEditableRef.current.innerHTML = '';
      } else {
        contentEditableRef.current.innerHTML = value;
      }
    }
  }, [value]);

  const handleInput = () => {
    if (contentEditableRef.current) {
      isInternalChange.current = true;
      onChange(contentEditableRef.current.innerHTML);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div
      ref={contentEditableRef}
      contentEditable
      onInput={handleInput}
      onBlur={handleInput}
      onPaste={handlePaste}
      className={`min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto ${className}`}
      data-placeholder={placeholder}
      style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    />
  );
};
