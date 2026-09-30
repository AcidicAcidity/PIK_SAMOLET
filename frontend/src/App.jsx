import { Link, Route, Routes } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import Layout, { RequireAuth } from './components/Layout'
import { Empty } from './components/ui'
import AdminPanel from './pages/admin/Admin'
import AccountLayout, { Favorites, MyBookings, MyMortgage, Overview, Profile } from './pages/account/Account'
import ApartmentDetail from './pages/ApartmentDetail'
import { Forgot, Login, Register } from './pages/Auth'
import Catalog from './pages/Catalog'
import Compare from './pages/Compare'
import { ComplexDetail, ComplexList, News } from './pages/Complexes'
import Home from './pages/Home'
import Loyalty from './pages/Loyalty'
import ManagerLayout, { Dashboard, ManagerApartments, ManagerBookings, ManagerLeads, ManagerMortgage } from './pages/manager/Manager'
import Mortgage from './pages/Mortgage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="apartments" element={<Catalog />} />
        <Route path="apartments/:id" element={<ApartmentDetail />} />
        <Route path="complexes" element={<ComplexList />} />
        <Route path="complexes/:slug" element={<ComplexDetail />} />
        <Route path="mortgage" element={<Mortgage />} />
        <Route path="loyalty" element={<Loyalty />} />
        <Route path="news" element={<News />} />
        <Route path="compare" element={<Compare />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot" element={<Forgot />} />

        <Route path="account" element={<RequireAuth><AccountLayout /></RequireAuth>}>
          <Route index element={<Overview />} />
          <Route path="bookings" element={<MyBookings />} />
          <Route path="mortgage" element={<MyMortgage />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="manager" element={<RequireAuth role="manager"><ManagerLayout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="bookings" element={<ManagerBookings />} />
          <Route path="mortgage" element={<ManagerMortgage />} />
          <Route path="leads" element={<ManagerLeads />} />
          <Route path="apartments" element={<ManagerApartments />} />
        </Route>

        <Route path="admin" element={<RequireAuth role="admin"><AdminPanel /></RequireAuth>} />

        <Route path="*" element={
          <div className="container section">
            <Empty icon={MapPin} title="Страница не найдена" text="Возможно, она была перемещена или удалена."
              action={<Link to="/" className="btn btn-accent">На главную</Link>} />
          </div>
        } />
      </Route>
    </Routes>
  )
}
