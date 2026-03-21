import { Routes, Route } from 'react-router-dom';
import Layout from './pages/Layout';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Leads from './pages/Leads';
import Templates from './pages/Templates';
import Campaigns from './pages/Campaigns';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/campaigns" element={<Campaigns />} />
      </Route>
    </Routes>
  );
}
