import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Monitor, X, CheckCircle2 } from 'lucide-react';

const ThemeSettingsDrawer = ({ isOpen, onClose, currentTheme, onThemeChange }) => {
  const [selected, setSelected] = useState(currentTheme || 'system');

  useEffect(() => {
    if (currentTheme) setSelected(currentTheme);
  }, [currentTheme]);

  const handleSelect = (mode) => {
    setSelected(mode);
    onThemeChange(mode);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const options = [
    {
      id: 'light',
      title: 'Light Mode',
      subtitle: 'Crisp and clear for daytime',
      icon: <Sun size={24} className="theme-icon" />,
      color: '#F59E0B'
    },
    {
      id: 'dark',
      title: 'Dark Mode',
      subtitle: 'Easy on the eyes, sleek UI',
      icon: <Moon size={24} className="theme-icon" />,
      color: '#3B82F6'
    },
    {
      id: 'system',
      title: 'System Default',
      subtitle: 'Matches your device settings',
      icon: <Monitor size={24} className="theme-icon" />,
      color: '#10B981'
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="theme-drawer-backdrop"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="theme-drawer-sheet"
          >
            <div className="theme-drawer-header">
              <div>
                <h2>Choose Theme</h2>
                <p>Customize your console appearance</p>
              </div>
              <button onClick={onClose} className="theme-drawer-close">
                <X size={20} />
              </button>
            </div>

            <div className="theme-drawer-body">
              {options.map((option) => {
                const isSelected = selected === option.id;
                return (
                  <motion.div
                    key={option.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect(option.id)}
                    className={`theme-card ${isSelected ? 'selected' : ''}`}
                    style={{
                      '--card-accent': option.color
                    }}
                  >
                    <div className="theme-card-icon" style={{ backgroundColor: `${option.color}20`, color: option.color }}>
                      {option.icon}
                    </div>
                    
                    <div className="theme-card-content">
                      <span className="theme-card-title">{option.title}</span>
                      <span className="theme-card-subtitle">{option.subtitle}</span>
                    </div>

                    <div className="theme-card-radio">
                      {isSelected && (
                        <motion.div 
                          initial={{ scale: 0 }} 
                          animate={{ scale: 1 }} 
                          transition={{ type: 'spring', stiffness: 300 }}
                        >
                          <CheckCircle2 size={24} color={option.color} fill={`${option.color}30`} />
                        </motion.div>
                      )}
                      {!isSelected && <div className="theme-card-radio-empty" />}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ThemeSettingsDrawer;
