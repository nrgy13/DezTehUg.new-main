import Link from 'next/link';
import { Shield, Phone, Mail, MapPin, Clock, Award } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-bg-secondary border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-poison-green" />
              <div className="flex flex-col">
                <span className="text-xl font-orbitron font-bold text-content-primary">
                  DEZTECHYUG
                </span>
                <span className="text-xs text-content-secondary -mt-1">
                  Pest Control Future
                </span>
              </div>
            </Link>
            <p className="text-sm text-content-secondary max-w-sm">
              Элитная команда технологичных специалистов. 10 лет безупречной работы. 
              Полное уничтожение угроз за 24 часа.
            </p>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm">
                <Award className="h-4 w-4 text-poison-green" />
                <span className="text-content-secondary">15 лицензий</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Clock className="h-4 w-4 text-neon-orange" />
                <span className="text-content-secondary">24/7</span>
              </div>
            </div>
          </div>

          {/* Services */}
          <div className="space-y-4">
            <h3 className="text-lg font-orbitron font-semibold text-content-primary">
              Услуги
            </h3>
            <nav className="space-y-2">
              <Link href="/services/disinfection" className="block text-sm text-content-secondary hover:text-poison-green transition-colors">
                Дезинфекция
              </Link>
              <Link href="/services/pest-control" className="block text-sm text-content-secondary hover:text-poison-green transition-colors">
                Дезинсекция
              </Link>
              <Link href="/services/deratization" className="block text-sm text-content-secondary hover:text-poison-green transition-colors">
                Дератизация
              </Link>
              <Link href="/services/water-analysis" className="block text-sm text-content-secondary hover:text-poison-green transition-colors">
                Анализ воды
              </Link>
            </nav>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-orbitron font-semibold text-content-primary">
              Информация
            </h3>
            <nav className="space-y-2">
              <Link href="/calculator" className="block text-sm text-content-secondary hover:text-poison-green transition-colors">
                Калькулятор стоимости
              </Link>
              <Link href="/about" className="block text-sm text-content-secondary hover:text-poison-green transition-colors">
                О компании
              </Link>
              <Link href="/contact" className="block text-sm text-content-secondary hover:text-poison-green transition-colors">
                Контакты
              </Link>
              <Link href="/privacy" className="block text-sm text-content-secondary hover:text-poison-green transition-colors">
                Политика конфиденциальности
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-lg font-orbitron font-semibold text-content-primary">
              Контакты
            </h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Phone className="h-5 w-5 text-poison-green mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-content-primary">
                    +7 (XXX) XXX-XX-XX
                  </p>
                  <p className="text-xs text-content-secondary">
                    Круглосуточно
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-neon-orange mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-content-primary">
                    info@deztechyug.ru
                  </p>
                  <p className="text-xs text-content-secondary">
                    Ответ в течение 30 минут
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-cyber-blue mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-content-primary">
                    г. Краснодар
                  </p>
                  <p className="text-xs text-content-secondary">
                    Выезд по всему региону
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-content-secondary">
              © 2024 DEZTECHYUG. Все права защищены.
            </p>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <span className="text-sm text-content-secondary">
                Лицензия № XXXX от XX.XX.XXXX
              </span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-poison-green rounded-full animate-pulse" />
                <span className="text-xs text-content-secondary">
                  Система работает в штатном режиме
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}