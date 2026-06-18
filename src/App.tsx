import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/shell/Header';
import E1Scenario from './screens/E1Scenario';
import E2Constraints from './screens/E2Constraints';
import E3Dashboard from './screens/E3Dashboard';
import AgentSubScreen from './screens/AgentSubScreen';
import WorkflowChain from './screens/WorkflowChain';
import E4Concepts from './screens/E4Concepts';
import E5Detail from './screens/E5Detail';
import E6Selection from './screens/E6Selection';
import E7GateReview from './screens/E7GateReview';
import E8Glossary from './screens/E8Glossary';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="min-h-full">
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <main className="min-h-[calc(100vh-3.5rem)]">
        <Routes>
          <Route path="/" element={<Navigate to="/e1" replace />} />
          <Route path="/e1" element={<E1Scenario />} />
          <Route path="/e2" element={<E2Constraints />} />
          <Route path="/e3" element={<E3Dashboard />} />
          <Route path="/e3/:agentId" element={<AgentSubScreen />} />
          <Route path="/workflow" element={<WorkflowChain />} />
          <Route path="/e4" element={<E4Concepts />} />
          <Route path="/e5/:conceptId" element={<E5Detail />} />
          <Route path="/e6" element={<E6Selection />} />
          <Route path="/e7" element={<E7GateReview />} />
          <Route path="/e8" element={<E8Glossary />} />
          <Route path="*" element={<Navigate to="/e1" replace />} />
        </Routes>
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
