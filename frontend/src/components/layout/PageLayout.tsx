import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import Breadcrumbs from './Breadcrumbs';

export default function PageLayout() {
    return (
        <div className="min-h-screen bg-background">
            <AppSidebar />

            {/* Main content area */}
            <main className="ml-sidebar min-h-screen">
                <div className="p-content">
                    <Breadcrumbs />
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
