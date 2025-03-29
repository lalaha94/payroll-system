import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Link as MuiLink, // Alias Link to avoid conflict with React Router's Link
  TextField, // For potential contact/lead form later
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Calculate, // For calculations feature
  TrendingUp, // For growth/performance
  CheckCircleOutline, // For accuracy/approval
  AccessTime, // For time saving
  Groups, // For team collaboration
  AccountBalanceWallet, // For payroll/finance
  ChevronRight, // Arrow icon
  FormatQuote, // For testimonials
  Business, // Placeholder icon
  Security, // For data security
  CloudUpload, // For data connection
  Rule, // For flexible rules
  Speed, // For efficiency
} from '@mui/icons-material';

// Optional: If you have react-router-dom for internal navigation
// import { Link as RouterLink } from 'react-router-dom';

// --- System Font Stack (Consistent, modern, performant) ---
const systemFontStack = [
  'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto',
  '"Helvetica Neue"', 'Arial', 'sans-serif', '"Apple Color Emoji"',
  '"Segoe UI Emoji"', '"Segoe UI Symbol"',
].join(',');

function LandingPage() {
  const theme = useTheme();

  // --- Section Styles (Helper function for cleaner code) ---
  const sectionStyles = (bgColor = 'transparent', py = { xs: 6, md: 10 }) => ({
    py: py, // Vertical padding (responsive)
    backgroundColor: bgColor,
    fontFamily: systemFontStack,
  });

  // --- Feature Item Component (Reusable) ---
  const FeatureItem = ({ icon, title, description }) => (
    <Grid item xs={12} sm={6} md={4}> {/* Adjust grid size as needed */}
      <Paper elevation={0} sx={{ p: 3, textAlign: 'center', height: '100%', border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
        <Box sx={{ color: 'primary.main', mb: 2 }}>
          {icon || <Business sx={{ fontSize: 40 }} />} {/* Placeholder icon */}
        </Box>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Paper>
    </Grid>
  );

  // --- Testimonial Item Component (Reusable) ---
    const TestimonialItem = ({ quote, name, title, company, avatarSrc }) => (
    <Grid item xs={12} md={4}> {/* Three testimonials per row on medium screens */}
      <Paper variant="outlined" sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 2 }}>
        <Box>
           <FormatQuote sx={{ color: 'primary.light', fontSize: 40, mb: 1 }} />
           <Typography variant="body1" sx={{ fontStyle: 'italic', mb: 2 }}>
             "{quote}"
           </Typography>
        </Box>
         <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
            <Avatar src={avatarSrc} sx={{ width: 48, height: 48, mr: 2 }}>{name ? name[0] : '?'}</Avatar> {/* Placeholder Avatar */}
            <Box>
               <Typography variant="subtitle2" fontWeight="bold">{name}</Typography>
               <Typography variant="caption" color="text.secondary">{title}, {company}</Typography>
            </Box>
         </Box>
      </Paper>
    </Grid>
  );


  return (
    <Box sx={{ width: '100%', overflowX: 'hidden' /* Prevent horizontal scroll */ }}>

      {/* --- 1. Hero Section --- */}
      <Box
        sx={{
          ...sectionStyles(alpha(theme.palette.primary.light, 0.1), { xs: 8, md: 12 }), // Lighter primary bg
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
           {/* Optional Tagline/Badge */}
          <Typography
             component="div"
             variant="caption"
             sx={{
                display: 'inline-block',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                px: 1.5, py: 0.5,
                borderRadius: '12px',
                mb: 2,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
             }}
            >
            For Sales Teams & Finance
          </Typography>
          <Typography
            variant="h2" // Main headline
            component="h1"
            sx={{
              fontWeight: 700,
              mb: 2,
              letterSpacing: '-0.5px',
              fontSize: { xs: '2.5rem', sm: '3rem', md: '3.5rem' }, // Responsive font size
              color: 'primary.dark',
            }}
          >
            Automate Your Sales Commissions & Payroll
          </Typography>
          <Typography
            variant="h6" // Sub-headline
            color="text.secondary"
            sx={{ mb: 4, fontWeight: 400, maxWidth: '700px', mx: 'auto' }} // Limit width
          >
            Stop wrestling with spreadsheets and complex rules. SalesPayroll streamlines commission management from closing the deal to paying your team accurately.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              href="#request-demo" // Link to demo section or form
              sx={{ borderRadius: '8px', px: 4, py: 1.5, textTransform: 'none', fontSize: '1rem' }}
            >
              Request a Demo
            </Button>
            {/* <Button
              variant="outlined"
              color="primary"
              size="large"
              href="#features" // Link to features section
              sx={{ borderRadius: '8px', px: 4, py: 1.5, textTransform: 'none', fontSize: '1rem' }}
            >
              Learn More
            </Button> */}
          </Box>
        </Container>
      </Box>

      {/* --- 2. Problem/Solution (Simplified Features Intro) --- */}
      <Box sx={sectionStyles(theme.palette.background.paper)}>
        <Container maxWidth="lg">
          <Typography variant="h4" sx={{ textAlign: 'center', fontWeight: 600, mb: 6 }}>
            Say Goodbye to Payroll Headaches
          </Typography>
          <Grid container spacing={4} alignItems="center">
             {/* You can add an image/illustration here if desired */}
             {/* <Grid item xs={12} md={5}>
                 <Box sx={{ width: '100%', height: '300px', bgcolor: 'grey.300', borderRadius: 2 }}>
                    [ Placeholder for Illustration/Screenshot ]
                 </Box>
              </Grid> */}
            <Grid item xs={12} md={12}> {/* Changed to full width if no image */}
               <Typography variant="h6" color="text.secondary" sx={{ mb: 3, fontWeight: 400 }}>
                  Calculating sales commissions manually is time-consuming, error-prone, and lacks transparency. This leads to disputes, demotivated reps, and hours wasted by finance and management.
              </Typography>
               <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  SalesPayroll provides the solution:
               </Typography>
               <List dense sx={{ mb: 2 }}>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 32 }}><CheckCircleOutline color="success" fontSize="small" /></ListItemIcon>
                    <ListItemText primary="Automated, accurate commission calculations." primaryTypographyProps={{ variant: 'body1' }} />
                  </ListItem>
                   <ListItem>
                     <ListItemIcon sx={{ minWidth: 32 }}><Speed color="success" fontSize="small" /></ListItemIcon>
                     <ListItemText primary="Reduce payroll processing time dramatically." primaryTypographyProps={{ variant: 'body1' }} />
                  </ListItem>
                   <ListItem>
                     <ListItemIcon sx={{ minWidth: 32 }}><TrendingUp color="success" fontSize="small" /></ListItemIcon>
                     <ListItemText primary="Clear visibility for sales reps and managers." primaryTypographyProps={{ variant: 'body1' }}/>
                  </ListItem>
                   <ListItem>
                     <ListItemIcon sx={{ minWidth: 32 }}><Rule color="success" fontSize="small" /></ListItemIcon>
                     <ListItemText primary="Handle complex commission rules with ease." primaryTypographyProps={{ variant: 'body1' }} />
                  </ListItem>
               </List>
               {/* CTA can be repeated subtly */}
               {/* <Button variant="text" color="primary" endIcon={<ChevronRight/>}>Explore Features</Button> */}
            </Grid>
          </Grid>
        </Container>
      </Box>

       {/* --- 3. Key Features --- */}
       <Box sx={sectionStyles(alpha(theme.palette.grey[100], 0.5))} id="features">
         <Container maxWidth="lg">
           <Typography variant="h4" sx={{ textAlign: 'center', fontWeight: 600, mb: 6 }}>
             Powerful Features Built for Growth
           </Typography>
           <Grid container spacing={3}>
             <FeatureItem
                icon={<Calculate sx={{ fontSize: 40 }} />}
                title="Automated Calculations"
                description="Eliminate manual errors. Our system calculates commissions based on your defined rules and data."
              />
              <FeatureItem
                 icon={<Rule sx={{ fontSize: 40 }} />}
                title="Flexible Rule Engine"
                description="Support tiered rates, bonuses, splits, overrides, and custom commission structures effortlessly."
              />
              <FeatureItem
                 icon={<Dashboard sx={{ fontSize: 40 }} />}
                title="Real-time Dashboards"
                description="Give sales reps and managers instant visibility into performance, earnings, and payout status."
              />
              <FeatureItem
                 icon={<CheckCircleOutline sx={{ fontSize: 40 }} />}
                 title="Approval Workflows"
                description="Streamline the review and approval process for managers before payroll is finalized."
              />
              <FeatureItem
                icon={<AccountBalanceWallet sx={{ fontSize: 40 }} />}
                title="Payroll Integration"
                description="Easily export approved commission data for seamless integration with your existing payroll system."
               />
              <FeatureItem
                icon={<Security sx={{ fontSize: 40 }} />}
                title="Secure & Scalable"
                 description="Built with enterprise-grade security and designed to grow with your sales team."
              />
           </Grid>
         </Container>
       </Box>

        {/* --- 4. How It Works (Optional Simple Steps) --- */}
       <Box sx={sectionStyles(theme.palette.background.paper)}>
         <Container maxWidth="md">
             <Typography variant="h4" sx={{ textAlign: 'center', fontWeight: 600, mb: 6 }}>
              Get Started in Minutes
            </Typography>
            <Grid container spacing={4} textAlign="center">
               <Grid item xs={12} sm={4}>
                   <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 56, height: 56, mx: 'auto', mb: 2 }}>1</Avatar>
                  <Typography variant="h6" fontWeight={500} gutterBottom>Connect Data</Typography>
                  <Typography variant="body2" color="text.secondary">Securely link your CRM or upload sales data.</Typography>
              </Grid>
               <Grid item xs={12} sm={4}>
                   <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 56, height: 56, mx: 'auto', mb: 2 }}>2</Avatar>
                  <Typography variant="h6" fontWeight={500} gutterBottom>Define Rules</Typography>
                  <Typography variant="body2" color="text.secondary">Configure your specific commission plans and models.</Typography>
              </Grid>
               <Grid item xs={12} sm={4}>
                   <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 56, height: 56, mx: 'auto', mb: 2 }}>3</Avatar>
                   <Typography variant="h6" fontWeight={500} gutterBottom>Automate & Approve</Typography>
                  <Typography variant="body2" color="text.secondary">Review calculations and approve payouts effortlessly.</Typography>
               </Grid>
            </Grid>
         </Container>
      </Box>


       {/* --- 5. Testimonials / Social Proof --- */}
       <Box sx={sectionStyles(alpha(theme.palette.primary.light, 0.1))} id="testimonials">
          <Container maxWidth="lg">
            <Typography variant="h4" sx={{ textAlign: 'center', fontWeight: 600, mb: 6 }}>
               Trusted by Leading Sales Teams
             </Typography>
             {/* Placeholder for Logos if available */}
             {/* <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 4, mb: 6, filter: 'grayscale(100%)', opacity: 0.6 }}>
                <Business sx={{ fontSize: 50 }} />
                <Business sx={{ fontSize: 50 }} />
                <Business sx={{ fontSize: 50 }} />
                <Business sx={{ fontSize: 50 }} />
                <Business sx={{ fontSize: 50 }} />
             </Box> */}
             <Grid container spacing={3} justifyContent="center">
               {/* Replace with REAL testimonials */}
               <TestimonialItem
                 quote="SalesPayroll has saved us countless hours each month. Payroll is faster, and our reps trust the numbers."
                  name="Jane D."
                  title="VP of Sales"
                  company="TechForward Inc."
                  // avatarSrc="/path/to/jane.jpg" // Optional image
                />
                <TestimonialItem
                  quote="The flexibility to handle our complex commission structure was a game-changer. Highly recommended!"
                  name="Mike R."
                 title="Finance Manager"
                  company="Growth Solutions"
                 />
                 <TestimonialItem
                  quote="Finally, clear visibility into my commissions! I know exactly what I'm earning and when I'll get paid."
                  name="Sarah K."
                 title="Account Executive"
                 company="Innovate Co."
                 />
             </Grid>
          </Container>
        </Box>


        {/* --- 6. Final Call to Action (CTA) --- */}
        <Box sx={sectionStyles(theme.palette.primary.main, { xs: 8, md: 12 })} id="request-demo">
           <Container maxWidth="md" sx={{ textAlign: 'center' }}>
            <Typography
               variant="h4"
              component="h2"
              sx={{ fontWeight: 700, mb: 3, color: 'primary.contrastText' }}
             >
               Ready to Simplify Your Commission Payroll?
             </Typography>
             <Typography variant="h6" sx={{ mb: 4, color: alpha(theme.palette.common.white, 0.85) }}>
                See SalesPayroll in action and discover how much time and money you can save. Get a personalized demo today.
             </Typography>
             {/* You might embed a simple form here or link out */}
              <Button
                variant="contained"
                // Use a contrasting color like secondary or a light color
                color="secondary" // Or style manually for white/light gray
                 size="large"
                 href="/demo-request" // Link to your demo request page/form
                sx={{
                   borderRadius: '8px', px: 5, py: 1.5, textTransform: 'none', fontSize: '1.1rem',
                   // Example manual styling for light button on dark background:
                    // bgcolor: 'white',
                    // color: 'primary.main',
                    // '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.9) }
                }}
             >
                Request Your Free Demo
             </Button>
            {/* Optional: Add a contact link */}
            {/* <Typography variant="body2" sx={{ mt: 3, color: alpha(theme.palette.common.white, 0.7) }}>
                Have questions? <MuiLink href="/contact" color="inherit">Contact Us</MuiLink>
            </Typography> */}
           </Container>
        </Box>


       {/* --- 7. Footer --- */}
      <Box component="footer" sx={{ py: 4, backgroundColor: theme.palette.grey[200] }}>
        <Container maxWidth="lg">
           <Grid container spacing={2} justifyContent="space-between" alignItems="center">
              <Grid item xs={12} sm="auto">
                 <Typography variant="body2" color="text.secondary">
                  © {new Date().getFullYear()} SalesPayroll. All rights reserved.
                 </Typography>
               </Grid>
               <Grid item xs={12} sm="auto">
                  {/* Add essential footer links */}
                  <MuiLink href="/privacy-policy" variant="body2" color="text.secondary" sx={{ mr: 2 }}>Privacy Policy</MuiLink>
                  <MuiLink href="/terms-of-service" variant="body2" color="text.secondary">Terms of Service</MuiLink>
              </Grid>
           </Grid>
        </Container>
      </Box>

     </Box>
  );
}

export default LandingPage;