// Example: adding H4ZP HR to your existing React website (react-router v6).
// Copy src/h4zp-hr into your project's src folder first.
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import H4ZPHR from './h4zp-hr';
// ...your existing page imports

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* your existing routes, e.g. */}
        {/* <Route path="/index" element={<Home />} /> */}
        <Route path="/hr/*" element={<H4ZPHR />} />
      </Routes>
    </BrowserRouter>
  );
}

// In your site's navigation menu add a link (keep it out of the public menu if you prefer —
// the page is protected by login either way):
//   <Link to="/hr">H4ZP HR</Link>
