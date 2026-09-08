import { HashRouter, Routes, Route } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { Shell } from './components/layout/Shell';
import { Dashboard } from './pages/Dashboard';
import { PODetail } from './pages/PO/PODetail';
import { P2PConfigHub } from './pages/ConditionMaster/P2PConfigHub';
import { ConditionMasterList } from './pages/ConditionMaster/ConditionMasterList';
import { PlaceholderConfig } from './pages/ConditionMaster/PlaceholderConfig';

export default function App() {
  return (
    <DataProvider>
      <HashRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/po" element={<Dashboard />} />
            <Route path="/po/:id" element={<PODetail />} />
            <Route path="/control-room/p2p" element={<P2PConfigHub />} />
            <Route path="/control-room/p2p/conditions" element={<ConditionMasterList />} />
            <Route path="/control-room/*" element={<PlaceholderConfig />} />
            <Route path="/app/*" element={<PlaceholderConfig />} />
          </Routes>
        </Shell>
      </HashRouter>
    </DataProvider>
  );
}
