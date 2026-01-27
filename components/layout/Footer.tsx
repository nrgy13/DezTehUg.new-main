'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Phone, Mail, MapPin, Clock, Award, Send, MessageCircle, MessageSquare } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { PrivacyModal } from '@/components/PrivacyModal';

export function Footer() {
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10 max-w-6xl mx-auto">
            
            {/* Brand Section */}
            <div className="flex flex-col items-center text-center h-full">
              <div className="mb-6">
                <Link href="/" className="inline-block group">
                  <BrandLogo className="text-3xl transition-all duration-300 group-hover:scale-105 group-hover:drop-shadow-[0_0_15px_#39FF14]" />
                </Link>
              </div>
              
              <div className="mb-6">
                <p className="text-content-secondary text-sm leading-relaxed max-w-xs mx-auto font-light group-hover:text-content-primary transition-colors">
                  Профессиональные решения для защиты вашего пространства.
                  Технологии будущего уже сегодня.
                </p>
              </div>
              
              {/* Enhanced Trust Indicators */}
              <div className="flex flex-col items-center gap-3.5 w-full">
                {/* QR Code and License */}
                <Link 
                  href="/license" 
                  className="flex items-center gap-2.5 group cursor-pointer w-full justify-center p-3 rounded-lg bg-gradient-to-r from-neon-orange/5 to-poison-green/5 border border-neon-orange/20 hover:border-poison-green/40 transition-all duration-300 hover:shadow-[0_0_12px_rgba(57,255,20,0.3)]"
                >
                  <div className="w-8 h-8 bg-white border-2 border-neon-orange rounded-xl flex items-center justify-center group-hover:bg-neon-orange/10 group-hover:border-poison-green transition-all duration-300 shadow-[0_0_8px_rgba(255,107,53,0.3)] group-hover:shadow-[0_0_15px_rgba(57,255,20,0.5)] flex-shrink-0">
                    {/* Placeholder for QR code image - will be added later */}
                    <Award className="w-4 h-4 text-neon-orange group-hover:text-poison-green transition-colors" />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-semibold text-content-primary group-hover:text-poison-green transition-colors leading-tight">
                      Лицензия №23.КК.08.003.Л.000016.02.25
                    </div>
                    <div className="text-xs text-content-muted mt-0.5">
                      от 13.02.2025 г.
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-3 group cursor-pointer">
                  <div className="w-3 h-3 bg-poison-green rounded-full animate-pulse shadow-[0_0_8px_#39FF14] group-hover:shadow-[0_0_15px_#39FF14] transition-all duration-300" />
                  <span className="text-xs font-medium text-content-muted group-hover:text-poison-green group-hover:drop-shadow-[0_0_5px_#39FF14] transition-all duration-300">
                    Онлайн 24/7
                  </span>
                </div>
              </div>
            </div>

            {/* Company */}
            <div className="flex flex-col items-center text-center h-full">
              <div className="mb-6 w-full">
                <h3 className="text-lg font-orbitron font-semibold text-content-primary relative group cursor-default w-full">
                  <span className="relative z-10 inline-block">Компания</span>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-neon-orange to-transparent group-hover:shadow-[0_0_8px_#FF6B35] transition-all duration-300" />
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-neon-orange group-hover:w-12 transition-all duration-500 shadow-[0_0_5px_#FF6B35]" />
                </h3>
              </div>
              <nav className="space-y-2.5 flex flex-col items-center w-full">
                {[
                  { href: '/about', label: 'О нас' },
                  { href: '/booking', label: 'Оформить заявку' },
                  { href: '/contact', label: 'Контакты' }
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
                <button
                  onClick={() => setIsPrivacyModalOpen(true)}
                  className="group flex items-center justify-center text-content-muted hover:text-neon-orange transition-all duration-300 relative"
                >
                  <div className="w-1 h-1 bg-current rounded-full mr-3 opacity-0 group-hover:opacity-100 group-hover:shadow-[0_0_5px_#FF6B35] transition-all duration-300" />
                  <span className="group-hover:translate-x-1 group-hover:drop-shadow-[0_0_3px_#FF6B35] transition-all duration-300 relative">
                    Конфиденциальность
                    <div className="absolute bottom-0 left-0 w-0 h-px bg-neon-orange group-hover:w-full transition-all duration-300 shadow-[0_0_3px_#FF6B35]" />
                  </span>
                </button>
              </nav>
            </div>

            {/* Contact */}
            <div className="flex flex-col items-center text-center h-full">
              <div className="mb-6 w-full">
                <h3 className="text-lg font-orbitron font-semibold text-content-primary relative group cursor-default w-full">
                  <span className="relative z-10 inline-block">Связь</span>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-cyber-blue to-transparent group-hover:shadow-[0_0_8px_#1E40AF] transition-all duration-300" />
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-cyber-blue group-hover:w-12 transition-all duration-500 shadow-[0_0_5px_#1E40AF]" />
                </h3>
              </div>
              <div className="space-y-3.5 flex flex-col items-center w-full">
                <div className="group flex items-center gap-2 cursor-pointer w-full justify-center">
                  <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-poison-green/10 group-hover:shadow-[0_0_8px_rgba(57,255,20,0.3)] transition-all duration-300 flex-shrink-0">
                    <Phone className="w-4 h-4 text-poison-green group-hover:drop-shadow-[0_0_5px_#39FF14] group-hover:scale-110 transition-all duration-300" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-content-primary text-sm group-hover:text-poison-green group-hover:drop-shadow-[0_0_3px_#39FF14] transition-all duration-300">8-988-319-43-52</p>
                    <p className="text-xs text-content-muted group-hover:text-content-secondary transition-all duration-300">Круглосуточно</p>
                  </div>
                </div>
                
                <div className="group flex items-center gap-2 cursor-pointer w-full justify-center">
                  <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-neon-orange/10 group-hover:shadow-[0_0_8px_rgba(255,107,53,0.3)] transition-all duration-300 flex-shrink-0">
                    <Mail className="w-4 h-4 text-neon-orange group-hover:drop-shadow-[0_0_5px_#FF6B35] group-hover:scale-110 transition-all duration-300" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-content-primary text-sm group-hover:text-neon-orange group-hover:drop-shadow-[0_0_3px_#FF6B35] transition-all duration-300">deztexug@yandex.ru</p>
                    <p className="text-xs text-content-muted group-hover:text-content-secondary transition-all duration-300">
                      <span className="">Ответ в течение 30 мин</span>
                    </p>
                  </div>
                </div>
                
                <div className="group flex items-center gap-2 cursor-pointer w-full justify-center">
                  <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-cyber-blue/10 group-hover:shadow-[0_0_8px_rgba(30,64,175,0.3)] transition-all duration-300 flex-shrink-0">
                    <MapPin className="w-4 h-4 text-cyber-blue group-hover:drop-shadow-[0_0_5px_#1E40AF] group-hover:scale-110 transition-all duration-300" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-content-primary text-sm group-hover:text-cyber-blue group-hover:drop-shadow-[0_0_3px_#1E40AF] transition-all duration-300">г. Новороссийск</p>
                    <p className="text-xs text-content-muted group-hover:text-content-secondary transition-all duration-300">Выезд по всему Краснодарскому краю</p>
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
                © <span className="font-orbitron font-semibold text-content-primary">ДЕЗТЕХЮГ</span>
              </p>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-content-muted font-medium">Мы в соцсетях:</span>
              <div className="flex items-center gap-3">
                {[
                  { icon: MessageCircle, href: 'https://wa.me/79883194352', color: 'hover:text-green-500', label: 'WhatsApp' },
                  { icon: Send, href: 'https://t.me/deztexugrf', color: 'hover:text-blue-400', label: 'Telegram' },
                  { 
                    icon: MessageSquare, 
                    href: 'https://max.ru', 
                    color: 'hover:text-purple-500', 
                    label: 'MAX'
                  }
                ].map((social, index) => {
                  return (
                    <a
                      key={index}
                      href={social.href}
                      target={social.label === 'MAX' ? '_blank' : undefined}
                      rel={social.label === 'MAX' ? 'noopener noreferrer' : undefined}
                      className={`w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center text-content-muted transition-all duration-300 hover:scale-110 hover:bg-white hover:shadow-lg ${social.color}`}
                    >
                      <social.icon className="w-4 h-4" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Privacy Modal */}
      <PrivacyModal 
        isOpen={isPrivacyModalOpen} 
        onClose={() => setIsPrivacyModalOpen(false)} 
      />
    </footer>
  );
}