'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Phone, Calculator } from 'lucide-react';
import { LogoText } from './LogoText';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { motion, AnimatePresence } from 'framer-motion';

const navigation = [
  { name: 'Главная', href: '/' },
  { name: 'Услуги', href: '/services' },
  { name: 'Оформить заявку', href: '/booking' },
  { name: 'О компании', href: '/about' },
  { name: 'Контакты', href: '/contact' },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed w-full top-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'bg-bg-primary/95 backdrop-blur-md shadow-lg border-b border-gray-200' 
        : 'bg-transparent'
    }`}>
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <LogoText />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-medium transition-all duration-300 relative group ${
                  pathname === item.href
                    ? 'text-neon-orange'
                    : 'text-content-primary hover:text-poison-green'
                }`}
              >
                {item.name}
                <span className={`absolute -bottom-1 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full ${
                  pathname === item.href ? 'bg-neon-orange w-full' : 'bg-poison-green'
                }`} />
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-content-secondary">
              <Phone className="h-4 w-4 text-poison-green" />
              <span className="font-medium">8-988-331-33-32</span>
            </div>
            <CyberpunkButton 
              href="/booking"
              variant="primary"
              size="sm"
              className="pulse-cta"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Оформить заявку
            </CyberpunkButton>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden p-2 rounded-md text-content-primary hover:text-poison-green transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:hidden overflow-hidden border-t border-gray-200 bg-bg-primary/95 backdrop-blur-md"
            >
              <div className="px-2 pt-2 pb-3 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      pathname === item.href
                        ? 'text-neon-orange bg-neon-orange/10'
                        : 'text-content-primary hover:text-poison-green hover:bg-poison-green/5'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
                <div className="px-3 py-2">
                  <div className="flex items-center space-x-2 text-sm text-content-secondary mb-3">
                    <Phone className="h-4 w-4 text-poison-green" />
                    <span className="font-medium">8-988-331-33-32</span>
                  </div>
                  <CyberpunkButton 
                    href="/booking"
                    variant="primary"
                    size="sm"
                    className="w-full"
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Оформить заявку
                  </CyberpunkButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}