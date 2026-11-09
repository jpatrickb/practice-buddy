import { BrowserRouter, Route, Routes } from 'react-router';
import { Failed } from '@/components/Screens';
import { Home } from '@/pages/Home';
import { PlayerPage } from '@/pages/PlayerPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/songs/:songId" element={<PlayerPage />} />
        <Route path="*" element={<Failed reason="not_found" retry={() => undefined} />} />
      </Routes>
    </BrowserRouter>
  );
}
