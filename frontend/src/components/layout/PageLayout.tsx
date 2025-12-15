import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';

export default function PageLayout() {
    return (
        <div className="min-h-screen bg-background">
            <AppSidebar />

            {/* Main content area */}
            <main className="ml-sidebar min-h-screen">
                <div className="p-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
