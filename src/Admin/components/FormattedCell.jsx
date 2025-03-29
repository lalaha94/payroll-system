import React from 'react';
import { Typography, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Custom formatted cell renderer
const FormattedCell = ({ value, type, valuePrefix = '', valueSuffix = ' kr', color }) => {
  const theme = useTheme();
  
  if (type === 'money') {
    const num = typeof value === 'number' ? value : Number(value);
    return (
      <Typography
        variant="body2"
        sx={{ 
          color: color || theme.palette.success.main,
          fontWeight: 'bold'
        }}
      >
        {!isNaN(num) 
          ? valuePrefix + num.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + valueSuffix
          : valuePrefix + '0,00' + valueSuffix}
      </Typography>
    );
  } else if (type === 'chip') {
    return (
      <Chip 
        label={value} 
        size="small"
        color={color || "default"}
        variant="outlined"
      />
    );
  }
  
  return <span>{value}</span>;
};

export default FormattedCell;
