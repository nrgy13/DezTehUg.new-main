import Link from 'next/link';
import { Phone, Mail, MapPin, Clock, Award, Instagram, Facebook, MessageCircle, Youtube } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export function Footer() {
  return (
    <footer className="relative bg-white overflow-hidden">
      {/* Enhanced Cyber Grid Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="footer-cyber-grid" width="25" height="25" patternUnits="userSpaceOnUse">
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#39FF14" strokeWidth="1.2"/>
              <circle cx="0" cy="0" r="1" fill="#39FF14" opacity="0.6"/>
              <circle cx="25" cy="25" r="1" fill="#FF6B35" opacity="0.4"/>
            </pattern>
            <pattern id="footer-cyber-lines" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 0 25 L 50 25" stroke="#1E40AF" strokeWidth="0.5" opacity="0.3"/>
              <path d="M 25 0 L 25 50" stroke="#1E40AF" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#footer-cyber-grid)" />
          <rect width="100%" height="100%" fill="url(#footer-cyber-lines)" />
        </svg>
      </div>
      
      {/* Enhanced Geometric Background Elements with Animation */}
      <div className="absolute inset-0 opacity-[0.05] overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-poison-green rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-neon-orange rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyber-blue rounded-full blur-2xl animate-pulse" style={{animationDelay: '2s'}} />
      </div>
      
      {/* Cyberpunk Top Border with Glow */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-poison-green to-transparent shadow-[0_0_10px_#39FF14]" />
      
      {/* Animated Scan Lines */}
      <div className="absolute inset-0 opacity-[0.03] overflow-hidden">
        <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-poison-green to-transparent animate-pulse top-1/4" />
        <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-neon-orange to-transparent animate-pulse top-2/4" style={{animationDelay: '1.5s'}} />
        <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-cyber-blue to-transparent animate-pulse top-3/4" style={{animationDelay: '3s'}} />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-12">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 lg:gap-8 max-w-6xl mx-auto">
            
            {/* Brand Section */}
            <div className="space-y-6 flex flex-col items-center text-center">
              <Link href="/" className="inline-block group">
                <BrandLogo className="text-3xl transition-all duration-300 group-hover:scale-105 group-hover:drop-shadow-[0_0_15px_#39FF14]" />
              </Link>
              
              <div className="space-y-6">
                <p className="text-content-secondary text-sm leading-relaxed max-w-48 font-light group-hover:text-content-primary transition-colors">
                  Профессиональные решения для защиты вашего пространства.
                  Технологии будущего уже сегодня.
                </p>
                
                {/* Enhanced Trust Indicators */}
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="w-3 h-3 bg-poison-green rounded-full animate-pulse shadow-[0_0_8px_#39FF14] group-hover:shadow-[0_0_15px_#39FF14] transition-all duration-300" />
                    <span className="text-xs font-medium text-content-muted group-hover:text-poison-green group-hover:drop-shadow-[0_0_5px_#39FF14] transition-all duration-300">
                      Онлайн 24/7
                    </span>
                  </div>
                  <div className="flex items-center gap-3 group cursor-pointer">
                    <Award className="w-4 h-4 text-neon-orange group-hover:drop-shadow-[0_0_8px_#FF6B35] transition-all duration-300" />
                    <span className="text-xs font-medium text-content-muted group-hover:text-neon-orange group-hover:drop-shadow-[0_0_5px_#FF6B35] transition-all duration-300">
                      15+ лицензий
                    </span>
                  </div>
                </div>
              </div>
            </div>

                {/* Services */}
                <div className="space-y-4 flex flex-col items-center text-center">
                  <h3 className="text-lg font-orbitron font-semibold text-content-primary relative group cursor-default">
                    Услуги
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-poison-green to-transparent group-hover:shadow-[0_0_8px_#39FF14] transition-all duration-300" />
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-poison-green group-hover:w-12 transition-all duration-500 shadow-[0_0_5px_#39FF14]" />
                  </h3>
                  <nav className="space-y-2.5 flex flex-col items-center">
                    {[
                      { href: '/services/disinfection', label: 'Дезинфекция' },
                      { href: '/services/pest-control', label: 'Дезинсекция' },
                      { href: '/services/deratization', label: 'Дератизация' },
                      { href: '/services/water-analysis', label: 'Анализ воды' }
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex items-center justify-center text-content-muted hover:text-poison-green transition-all duration-300 relative"
                      >
                        <div className="w-1 h-1 bg-current rounded-full mr-3 opacity-0 group-hover:opacity-100 group-hover:shadow-[0_0_5px_#39FF14] transition-all duration-300" />
                        <span className="group-hover:translate-x-1 group-hover:drop-shadow-[0_0_3px_#39FF14] transition-all duration-300 relative">
                          {item.label}
                          <div className="absolute bottom-0 left-0 w-0 h-px bg-poison-green group-hover:w-full transition-all duration-300 shadow-[0_0_3px_#39FF14]" />
                        </span>
                      </Link>
                    ))}
                  </nav>
                </div>

                {/* Company */}
                <div className="space-y-4 flex flex-col items-center text-center">
                  <h3 className="text-lg font-orbitron font-semibold text-content-primary relative group cursor-default">
                    Компания
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-neon-orange to-transparent group-hover:shadow-[0_0_8px_#FF6B35] transition-all duration-300" />
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-neon-orange group-hover:w-12 transition-all duration-500 shadow-[0_0_5px_#FF6B35]" />
                  </h3>
                  <nav className="space-y-2.5 flex flex-col items-center">
                    {[
                      { href: '/about', label: 'О нас' },
                      { href: '/calculator', label: 'Калькулятор' },
                      { href: '/contact', label: 'Контакты' },
                      { href: '/privacy', label: 'Конфиденциальность' }
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex items-center justify-center text-content-muted hover:text-neon-orange transition-all duration-300 relative"
                      >
                        <div className="w-1 h-1 bg-current rounded-full mr-3 opacity-0 group-hover:opacity-100 group-hover:shadow-[0_0_5px_#FF6B35] transition-all duration-300" />
                        <span className="group-hover:translate-x-1 group-hover:drop-shadow-[0_0_3px_#FF6B35] transition-all duration-300 relative">
                          {item.label}
                          <div className="absolute bottom-0 left-0 w-0 h-px bg-neon-orange group-hover:w-full transition-all duration-300 shadow-[0_0_3px_#FF6B35]" />
                        </span>
                      </Link>
                    ))}
                  </nav>
                </div>

                {/* Contact */}
                <div className="space-y-4 flex flex-col items-center text-center">
                  <h3 className="text-lg font-orbitron font-semibold text-content-primary relative group cursor-default">
                    Связь
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-cyber-blue to-transparent group-hover:shadow-[0_0_8px_#1E40AF] transition-all duration-300" />
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-cyber-blue group-hover:w-12 transition-all duration-500 shadow-[0_0_5px_#1E40AF]" />
                  </h3>
                  <div className="space-y-3.5 flex flex-col items-center">
                    <div className="group flex items-center gap-2 cursor-pointer">
                      <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-poison-green/10 group-hover:shadow-[0_0_8px_rgba(57,255,20,0.3)] transition-all duration-300 flex-shrink-0">
                        <Phone className="w-4 h-4 text-poison-green group-hover:drop-shadow-[0_0_5px_#39FF14] group-hover:scale-110 transition-all duration-300" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-content-primary text-sm group-hover:text-poison-green group-hover:drop-shadow-[0_0_3px_#39FF14] transition-all duration-300">+7 (XXX) XXX-XX-XX</p>
                        <p className="text-xs text-content-muted group-hover:text-content-secondary transition-all duration-300">Круглосуточно</p>
                      </div>
                    </div>
                    
                    <div className="group flex items-center gap-2 cursor-pointer">
                      <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-neon-orange/10 group-hover:shadow-[0_0_8px_rgba(255,107,53,0.3)] transition-all duration-300 flex-shrink-0">
                        <Mail className="w-4 h-4 text-neon-orange group-hover:drop-shadow-[0_0_5px_#FF6B35] group-hover:scale-110 transition-all duration-300" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-content-primary text-sm group-hover:text-neon-orange group-hover:drop-shadow-[0_0_3px_#FF6B35] transition-all duration-300">info@deztechyug.ru</p>
                        <p className="text-xs text-content-muted group-hover:text-content-secondary transition-all duration-300">
                          <span className="group-hover:animate-pulse">Ответ в течение 30 мин</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="group flex items-center gap-2 cursor-pointer">
                      <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-cyber-blue/10 group-hover:shadow-[0_0_8px_rgba(30,64,175,0.3)] transition-all duration-300 flex-shrink-0">
                        <MapPin className="w-4 h-4 text-cyber-blue group-hover:drop-shadow-[0_0_5px_#1E40AF] group-hover:scale-110 transition-all duration-300" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-content-primary text-sm group-hover:text-cyber-blue group-hover:drop-shadow-[0_0_3px_#1E40AF] transition-all duration-300">г. Краснодар</p>
                        <p className="text-xs text-content-muted group-hover:text-content-secondary transition-all duration-300">Выезд по всему региону</p>
                      </div>
                    </div>
                  </div>
                </div>
          </div>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100" />
          </div>
          <div className="relative flex justify-center">
            <div className="bg-white px-6">
              <div className="w-2 h-2 bg-gradient-to-r from-poison-green to-neon-orange rounded-full" />
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="py-6">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
            
            {/* Copyright */}
            <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-content-muted">
              <p>
                © 2024 <span className="font-orbitron font-semibold text-content-primary">ДЕЗТЕХЮГ</span>
              </p>
              <div className="hidden sm:block w-1 h-1 bg-content-muted rounded-full" />
              <p>Лицензия № XXXX от XX.XX.XXXX</p>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-content-muted font-medium">Мы в соцсетях:</span>
              <div className="flex items-center gap-3">
                {[
                  { icon: MessageCircle, href: '#', color: 'hover:text-blue-500' },
                  { icon: Instagram, href: '#', color: 'hover:text-pink-500' },
                  { icon: Facebook, href: '#', color: 'hover:text-blue-600' },
                  { icon: Youtube, href: '#', color: 'hover:text-red-500' }
                ].map((social, index) => (
                  <Link
                    key={index}
                    href={social.href}
                    className={`w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center text-content-muted transition-all duration-300 hover:scale-110 hover:bg-white hover:shadow-lg ${social.color}`}
                  >
                    <social.icon className="w-4 h-4" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}