package com.square.backend;

import com.square.backend.model.Asset;
import com.square.backend.model.AssetCondition;
import com.square.backend.model.AssetStatus;
import com.square.backend.model.Department;
import com.square.backend.model.Location;
import com.square.backend.model.Ticket;
import com.square.backend.model.User;
import com.square.backend.repository.AssetRepository;
import com.square.backend.repository.DepartmentRepository;
import com.square.backend.repository.LocationRepository;
import com.square.backend.repository.TicketRepository;
import com.square.backend.repository.UserRepository;
import com.square.backend.web.Validate;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@SpringBootApplication
public class BackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }

    // Extra demo employees generated on first boot (~100 records total across
    // users + tickets + assets so every dashboard looks realistically busy).
    private static final String[] GEN_FIRST = { "Rafiq", "Hasan", "Jannat", "Shakib", "Farzana", "Imran", "Sadia", "Rubel", "Tania", "Mahmud", "Rina", "Sohel", "Nabila", "Asif", "Sharmin", "Zahid", "Lamia", "Tarek", "Shorna", "Fahim" };
    private static final String[] GEN_LAST = { "Islam", "Hossain", "Rahman", "Akter", "Chowdhury", "Ahmed", "Karim", "Begum", "Uddin", "Khan" };
    // Only the fixed SQUARE designation ladder exists (Executive Director … Office Assistant)
    private static final String[] GEN_TITLES = { "Executive", "Officer", "Senior Executive", "Assistant Officer", "Deputy Manager", "Assistant Manager", "Office Assistant", "Executive", "Officer", "Senior Executive" };
    private static final String[] LOCATIONS = { "Anita Center (HQ)", "Sector 3 Office", "CSQ", "Bay Tower" };
    // The 3 bays inside the "IT Backup Support" storage room — mirrors the frontend's
    // STOCK_STORAGE_LOCATIONS, used only to give demo pool devices a non-blank "Stored at".
    private static final String[] STOCK_STORAGE_LOCATIONS = { "F11 Storage", "B2 Storage", "S3 Storage" };

    // Fillers so every department holds its full designation ladder — each unique
    // designation exactly once, each common one at least once (mirrors the frontend seed).
    private static final String[] FILL_FIRST = {
        "Arman", "Bashir", "Chandan", "Dilara", "Eshita", "Feroz", "Habib", "Ishrat", "Jubayer",
        "Kanta", "Liton", "Monir", "Nayeem", "Omar", "Parvez", "Rukhsana", "Salma", "Tuhin",
        "Wasim", "Yasmin", "Zubaida", "Anika", "Belal", "Chumki", "Delwar", "Elias", "Farid",
        "Galib", "Hafsa", "Iqbal", "Jesmin", "Kabir", "Lubna", "Mamun", "Nishat", "Oli",
        "Pial", "Rasel", "Shefali", "Tamim", "Urmi", "Waliul", "Yusuf", "Zakia", "Bristy",
    };
    // Aligned with the DEPARTMENTS array order
    private static final String[][] FILL_MISSING = {
        { "General Manager (GM)", "Deputy General Manager (DGM)", "Assistant General Manager (AGM)", "Deputy Manager", "Assistant Manager" },
        { "General Manager (GM)", "Deputy General Manager (DGM)", "Assistant General Manager (AGM)", "Manager", "Deputy Manager", "Assistant Manager", "Office Assistant" },
        { "General Manager (GM)", "Deputy General Manager (DGM)", "Assistant General Manager (AGM)", "Senior Manager", "Manager", "Assistant Manager", "Executive", "Assistant Officer", "Office Assistant" },
        { "General Manager (GM)", "Deputy General Manager (DGM)", "Assistant General Manager (AGM)", "Senior Manager", "Manager", "Deputy Manager", "Officer", "Office Assistant" },
        { "General Manager (GM)", "Deputy General Manager (DGM)", "Assistant General Manager (AGM)", "Senior Manager", "Manager", "Assistant Manager", "Officer", "Assistant Officer" },
        { "General Manager (GM)", "Deputy General Manager (DGM)", "Assistant General Manager (AGM)", "Senior Manager", "Deputy Manager", "Senior Executive", "Assistant Officer", "Office Assistant" },
    };
    private static final String[] DEPARTMENTS = { "HR and Admin", "Commercial", "Marketing and Merchandising", "Accounts and Finance", "Design and Product Development", "Central Procurement and Supply Chain" };
    private static final String[] PROBLEM_TYPES = { "Hardware Malfunction", "Software Crash", "Network/Wi-Fi Outage", "Printer Error", "Other" };

    /**
     * Demo/seed data for local development and showcasing.
     *
     * {@code @Profile("!prod & !test")} is a hard safety line: this runner
     * creates sign-in-able accounts, so it must never touch a production
     * database. Production uses {@link #initProductionEnvironment} below.
     *
     * The demo password is never stored in source. Set DEMO_PASSWORD to choose
     * one, or let the runner generate a random one and print it to the console
     * the first time it seeds.
     */
    @Bean
    @Profile("!prod & !test")
    CommandLineRunner initSystemEnvironment(UserRepository userRepo, TicketRepository ticketRepo, AssetRepository assetRepo,
                                            LocationRepository locationRepo, DepartmentRepository departmentRepo,
                                            @Value("${DEMO_PASSWORD:}") String configuredDemoPassword) {
        return args -> {
            // No demo password is written in this file. Set DEMO_PASSWORD to choose
            // one; otherwise a random one is generated and printed below, once, so
            // that nothing sign-in-able ever lives in version control.
            String demoPassword = configuredDemoPassword == null || configuredDemoPassword.isBlank()
                    ? Validate.temporaryPassword()
                    : configuredDemoPassword;
            // Seed the organization structure — from then on the Superuser manages it in the UI.
            if (locationRepo.count() == 0) {
                locationRepo.save(Location.builder().name("Anita Center (HQ)").floors(11).build());
                locationRepo.save(Location.builder().name("Sector 3 Office").floors(6).build());
                locationRepo.save(Location.builder().name("CSQ").floors(6).build());
                locationRepo.save(Location.builder().name("Bay Tower").floors(6).build());
            }
            if (departmentRepo.count() == 0) {
                for (String d : DEPARTMENTS) departmentRepo.save(Department.builder().name(d).build());
            }

            // Seed Authentication Directory + org chart (managerUsername links reports to their supervisor)
            if (userRepo.count() == 0) {
                userRepo.save(withProfile(new User("saif", demoPassword, "EMPLOYEE"), "Md Saif Shahriar", "Senior Executive", "manager1", 900, "Design and Product Development"));
                userRepo.save(withProfile(new User("raihan", demoPassword, "EMPLOYEE"), "Raihan Kabir", "Executive", "manager1", 1500, "Commercial"));
                userRepo.save(withProfile(new User("nusrat", demoPassword, "EMPLOYEE"), "Nusrat Jahan", "Officer", "manager1", 420, "Marketing and Merchandising"));
                userRepo.save(withProfile(new User("manager1", demoPassword, "SUPERVISOR"), "Rumana Karim", "Manager", null, 3200, "HR and Admin"));
                userRepo.save(withProfile(new User("tech1", demoPassword, "IT_TECH"), "Arif Chowdhury", "Executive", null, 2100, "HR and Admin"));
                userRepo.save(withProfile(new User("admin1", demoPassword, "SYSTEM_ADMIN"), "Nadia Rahman", "Senior Manager", null, 2800, "HR and Admin"));

                // Wider org chart — a second supervisor with her own reports, plus more IT Team members
                userRepo.save(withProfile(new User("tanvir", demoPassword, "EMPLOYEE"), "Tanvir Ahmed", "Executive", "manager1", 1100, "Accounts and Finance"));
                userRepo.save(withProfile(new User("sabrina", demoPassword, "EMPLOYEE"), "Sabrina Islam", "Senior Executive", "manager1", 700, "Design and Product Development"));
                userRepo.save(withProfile(new User("kamal", demoPassword, "EMPLOYEE"), "Kamal Hossain", "Manager", "manager1", 1900, "Central Procurement and Supply Chain"));
                // Rumana Karim (manager1) is the one and only Superuser; Priya is a regular User now
                userRepo.save(withProfile(new User("priya", demoPassword, "EMPLOYEE"), "Priya Chakraborty", "Senior Manager", "manager1", 2600, "Commercial"));
                userRepo.save(withProfile(new User("farhan", demoPassword, "EMPLOYEE"), "Farhan Islam", "Officer", "manager1", 500, "HR and Admin"));
                userRepo.save(withProfile(new User("mitu", demoPassword, "EMPLOYEE"), "Mitu Akter", "Executive", "manager1", 1300, "Commercial"));
                userRepo.save(withProfile(new User("tech2", demoPassword, "IT_TECH"), "Sabbir Ahmed", "Officer", null, 1700, "HR and Admin"));
                userRepo.save(withProfile(new User("tech3", demoPassword, "IT_TECH"), "Mehedi Hasan", "Assistant Officer", null, 1200, "HR and Admin"));
                userRepo.save(withProfile(new User("tech4", demoPassword, "IT_TECH"), "Shanta Akter", "Officer", null, 800, "HR and Admin"));

                // Company leadership — shown view-only under "Top essentials"
                userRepo.save(withProfile(new User("anisur", demoPassword, "EMPLOYEE"), "Anisur Rahman", "Executive Director", null, 4200, "HR and Admin"));
                userRepo.save(withProfile(new User("tapan", demoPassword, "EMPLOYEE"), "Tapan Chowdhury", "Director", null, 3600, "Commercial"));

                // Generated employees — all reporting to the Superuser
                for (int i = 0; i < GEN_FIRST.length; i++) {
                    String username = GEN_FIRST[i].toLowerCase();
                    String name = GEN_FIRST[i] + " " + GEN_LAST[i % GEN_LAST.length];
                    userRepo.save(withProfile(new User(username, demoPassword, "EMPLOYEE"), name, GEN_TITLES[i % GEN_TITLES.length], "manager1", 250 + i * 137, DEPARTMENTS[i % DEPARTMENTS.length]));
                }

                // Fillers — complete every department's required designation ladder
                int f = 0;
                for (int d = 0; d < DEPARTMENTS.length; d++) {
                    for (String desig : FILL_MISSING[d]) {
                        String first = FILL_FIRST[f];
                        userRepo.save(withProfile(new User(first.toLowerCase(), demoPassword, "EMPLOYEE"),
                                first + " " + GEN_LAST[f % GEN_LAST.length], desig, "manager1", 200 + f * 61, DEPARTMENTS[d]));
                        f++;
                    }
                }

                // Company-wide unique IDs derived from the database id: SQ-EMP-0001, ...
                // plus the HR and Admin unit split (IT staff to IT, rest alternating HR/Admin;
                // mirrors the frontend seed).
                for (User u : userRepo.findAll()) {
                    u.setEmployeeId(String.format("SQ-EMP-%04d", u.getId()));
                    if ("HR and Admin".equals(u.getDepartment())) {
                        boolean it = "IT_TECH".equals(u.getRole()) || "SYSTEM_ADMIN".equals(u.getRole());
                        u.setUnit(it ? "IT" : (u.getId() % 2 == 0 ? "HR" : "Admin"));
                    }
                    userRepo.save(u);
                }
                System.out.println("Seeded user directory into PostgreSQL (" + userRepo.count() + " users).");
            }

            // Seed the helpdesk ticket queue — straight to IT, no approval gate.
            if (ticketRepo.count() == 0) {
                // Open — awaiting a technician
                createMockTicket(ticketRepo, "saif", "Anita Center (HQ)", 4, "Design and Product Development", "Hardware Malfunction", null, "OPEN", null, 2, null);
                createMockTicket(ticketRepo, "raihan", "Anita Center (HQ)", 7, "Commercial", "Network/Wi-Fi Outage", null, "OPEN", null, 1, null);
                createMockTicket(ticketRepo, "nusrat", "Sector 3 Office", 2, "Marketing and Merchandising", "Other", "Monitor flickers intermittently when the AC kicks in", "OPEN", null, 3, null);
                createMockTicket(ticketRepo, "nusrat", "Sector 3 Office", 6, "Marketing and Merchandising", "Hardware Malfunction", null, "OPEN", null, 0, null);

                // Solving — accepted by a technician
                createMockTicket(ticketRepo, "tanvir", "Anita Center (HQ)", 9, "Accounts and Finance", "Software Crash", null, "SOLVING", "Arif Chowdhury", 4, null);
                createMockTicket(ticketRepo, "sabrina", "CSQ", 3, "Design and Product Development", "Printer Error", null, "SOLVING", "Arif Chowdhury", 2, null);
                createMockTicket(ticketRepo, "kamal", "Bay Tower", 5, "Central Procurement and Supply Chain", "Hardware Malfunction", null, "SOLVING", "Sabbir Ahmed", 3, null);
                createMockTicket(ticketRepo, "tanvir", "CSQ", 6, "Accounts and Finance", "Other", "Docking station won't charge the laptop past 20%", "SOLVING", "Sabbir Ahmed", 3, null);

                // Closed — resolved history
                createMockTicket(ticketRepo, "farhan", "Sector 3 Office", 1, "HR and Admin", "Network/Wi-Fi Outage", null, "CLOSED", "Sabbir Ahmed", 5, 2);
                createMockTicket(ticketRepo, "mitu", "Anita Center (HQ)", 2, "Commercial", "Software Crash", null, "CLOSED", "Arif Chowdhury", 14, 10);
                createMockTicket(ticketRepo, "saif", "Anita Center (HQ)", 4, "Design and Product Development", "Other", "Laptop fan makes a grinding noise under load", "CLOSED", "Arif Chowdhury", 23, 20);

                // Rejected
                createMockTicket(ticketRepo, "priya", "Anita Center (HQ)", 11, "HR and Admin", "Printer Error", null, "REJECTED", null, 7, 6);

                // Generated history spread across the generated employees
                String[] techNames = { "Arif Chowdhury", "Sabbir Ahmed" };
                for (int i = 0; i < 28; i++) {
                    String raiser = GEN_FIRST[i % GEN_FIRST.length].toLowerCase();
                    String location = LOCATIONS[i % LOCATIONS.length];
                    int floor = (i % (location.equals("Anita Center (HQ)") ? 11 : 6)) + 1;
                    String dept = DEPARTMENTS[i % DEPARTMENTS.length];
                    String problem = PROBLEM_TYPES[i % PROBLEM_TYPES.length];
                    String desc = problem.equals("Other") ? "Peripheral acting up — needs a technician visit" : null;
                    // Mix of states: mostly closed history, a few open/solving
                    String status = i % 7 == 0 ? "OPEN" : i % 7 == 1 ? "SOLVING" : i % 7 == 2 ? "REJECTED" : "CLOSED";
                    String acceptedBy = status.equals("OPEN") || status.equals("REJECTED") ? null : techNames[i % 2];
                    int createdDaysAgo = 3 + i * 3;
                    Integer resolvedDaysAgo = status.equals("CLOSED") || status.equals("REJECTED") ? Math.max(0, createdDaysAgo - 2) : null;
                    createMockTicket(ticketRepo, raiser, location, floor, dept, problem, desc, status, acceptedBy, createdDaysAgo, resolvedDaysAgo);
                }

                System.out.println("Seeded helpdesk ticket queue into PostgreSQL (" + ticketRepo.count() + " tickets).");
            }

            // Seed the asset inventory — needs real user ids, so it runs after users are saved.
            if (assetRepo.count() == 0) {
                Long saifId = userRepo.findByUsername("saif").map(User::getId).orElse(null);
                Long raihanId = userRepo.findByUsername("raihan").map(User::getId).orElse(null);
                Long nusratId = userRepo.findByUsername("nusrat").map(User::getId).orElse(null);
                Long tanvirId = userRepo.findByUsername("tanvir").map(User::getId).orElse(null);
                Long sabrinaId = userRepo.findByUsername("sabrina").map(User::getId).orElse(null);
                Long kamalId = userRepo.findByUsername("kamal").map(User::getId).orElse(null);
                Long farhanId = userRepo.findByUsername("farhan").map(User::getId).orElse(null);
                Long mituId = userRepo.findByUsername("mitu").map(User::getId).orElse(null);
                Long priyaId = userRepo.findByUsername("priya").map(User::getId).orElse(null);

                // Assigned to employees
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-89304-DL").deviceType("Model X Laptop")
                        .specifications("Core i9 · 32GB RAM · 1TB NVMe")
                        .status(AssetStatus.ALLOCATED_IN_USE)
                        .purchaseDate(LocalDate.now().minusDays(280)).warrantyExpiry(LocalDate.now().plusDays(450))
                        .originalValue(1400).usefulLifeYears(4).userId(saifId).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-50219-MB").deviceType("SQUARE Mobile Unit")
                        .specifications("5G · 256GB storage")
                        .status(AssetStatus.ALLOCATED_IN_USE)
                        .purchaseDate(LocalDate.now().minusDays(760)).warrantyExpiry(LocalDate.now().minusDays(30))
                        .originalValue(760).usefulLifeYears(3).userId(saifId).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-40077-DL").deviceType("Model X Laptop")
                        .specifications("Core i7 · 16GB RAM · 512GB NVMe")
                        .status(AssetStatus.ALLOCATED_IN_USE)
                        .purchaseDate(LocalDate.now().minusDays(100)).warrantyExpiry(LocalDate.now().plusDays(600))
                        .originalValue(1400).usefulLifeYears(4).userId(nusratId).build());

                // Loaner currently deployed — feeds the Live Loaner Ledger
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-91234-DL").deviceType("Model X Laptop")
                        .specifications("Core i5 · 16GB RAM · 512GB NVMe")
                        .status(AssetStatus.ALLOCATED_IN_USE)
                        .purchaseDate(LocalDate.now().minusDays(900)).warrantyExpiry(LocalDate.now().minusDays(50))
                        .originalValue(1200).usefulLifeYears(4).userId(raihanId)
                        .isLoaner(true).loanerIssuedAt(LocalDate.now().minusDays(6)).build());

                // Inventory — brand-new devices, issued only with supervisor acceptance
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-77120-DL").deviceType("Model X Laptop")
                        .specifications("Core i7 · 16GB RAM · 512GB NVMe")
                        .status(AssetStatus.AVAILABLE_IN_POOL).poolCondition(AssetCondition.NEW)
                        .purchaseDate(LocalDate.now().minusDays(60)).warrantyExpiry(LocalDate.now().plusDays(700))
                        .originalValue(1350).usefulLifeYears(4).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-61044-DL").deviceType("Model X Laptop")
                        .specifications("Core i5 · 16GB RAM · 256GB NVMe (repaired unit)")
                        .status(AssetStatus.AVAILABLE_IN_POOL).poolCondition(AssetCondition.REPAIRED)
                        .purchaseDate(LocalDate.now().minusDays(400)).warrantyExpiry(LocalDate.now().plusDays(200))
                        .originalValue(1100).usefulLifeYears(4).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-30022-WS").deviceType("Legacy Workstation")
                        .specifications("Core i5 · 8GB RAM · 256GB SSD")
                        .status(AssetStatus.AVAILABLE_IN_POOL).poolCondition(AssetCondition.OLD_FUNCTIONAL)
                        .purchaseDate(LocalDate.now().minusDays(900)).warrantyExpiry(LocalDate.now().minusDays(100))
                        .originalValue(900).usefulLifeYears(5).build());

                // Scrapped — feeds the Scrap Registry
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-10099-DL").deviceType("Model X Laptop")
                        .specifications("Core i9 · 32GB RAM · 1TB NVMe")
                        .status(AssetStatus.SCRAPPED)
                        .purchaseDate(LocalDate.now().minusDays(1000)).warrantyExpiry(LocalDate.now().minusDays(200))
                        .originalValue(1400).usefulLifeYears(4)
                        .scrapReason("Battery swelling — safety hazard, decommissioned per IT policy")
                        .scrappedAt(LocalDate.now().minusDays(15)).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-20087-SVR").deviceType("Data Server Stack")
                        .specifications("Dual Xeon · 128GB RAM · 8x NVMe RAID")
                        .status(AssetStatus.SCRAPPED)
                        .purchaseDate(LocalDate.now().minusDays(1200)).warrantyExpiry(LocalDate.now().minusDays(300))
                        .originalValue(8500).usefulLifeYears(6)
                        .scrapReason("Motherboard fire damage during PSU failure")
                        .scrappedAt(LocalDate.now().minusDays(40)).build());

                // More assigned devices — wider team, wider device-type mix
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-64521-DL").deviceType("Model X Laptop")
                        .specifications("Core i7 · 16GB RAM · 512GB NVMe")
                        .status(AssetStatus.ALLOCATED_IN_USE)
                        .purchaseDate(LocalDate.now().minusDays(150)).warrantyExpiry(LocalDate.now().plusDays(580))
                        .originalValue(1400).usefulLifeYears(4).userId(tanvirId).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-73390-DL").deviceType("Model X Laptop")
                        .specifications("Core i7 · 16GB RAM · 1TB NVMe")
                        .status(AssetStatus.ALLOCATED_IN_USE)
                        .purchaseDate(LocalDate.now().minusDays(45)).warrantyExpiry(LocalDate.now().plusDays(690))
                        .originalValue(1450).usefulLifeYears(4).userId(sabrinaId).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-88213-MB").deviceType("SQUARE Mobile Unit")
                        .specifications("5G · 256GB storage")
                        .status(AssetStatus.ALLOCATED_IN_USE)
                        .purchaseDate(LocalDate.now().minusDays(700)).warrantyExpiry(LocalDate.now().plusDays(15))
                        .originalValue(760).usefulLifeYears(3).userId(kamalId).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-99012-DT").deviceType("Standard Desktop")
                        .specifications("Ryzen 7 · 32GB RAM · 1TB SSD")
                        .status(AssetStatus.ALLOCATED_IN_USE)
                        .purchaseDate(LocalDate.now().minusDays(200)).warrantyExpiry(LocalDate.now().plusDays(520))
                        .originalValue(1100).usefulLifeYears(5).userId(farhanId).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-45678-DL").deviceType("Model X Laptop")
                        .specifications("Core i5 · 16GB RAM · 256GB NVMe")
                        .status(AssetStatus.ALLOCATED_IN_USE)
                        .purchaseDate(LocalDate.now().minusDays(820)).warrantyExpiry(LocalDate.now().minusDays(60))
                        .originalValue(1350).usefulLifeYears(4).userId(mituId).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-33109-DT").deviceType("Standard Desktop")
                        .specifications("Ryzen 5 · 16GB RAM · 512GB SSD")
                        .status(AssetStatus.ALLOCATED_IN_USE)
                        .purchaseDate(LocalDate.now().minusDays(300)).warrantyExpiry(LocalDate.now().plusDays(430))
                        .originalValue(950).usefulLifeYears(5).userId(priyaId).build());

                // More pool stock across all three conditions
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-15044-DL").deviceType("Model X Laptop")
                        .specifications("Core i7 · 16GB RAM · 512GB NVMe")
                        .status(AssetStatus.AVAILABLE_IN_POOL).poolCondition(AssetCondition.NEW)
                        .purchaseDate(LocalDate.now().minusDays(20)).warrantyExpiry(LocalDate.now().plusDays(740))
                        .originalValue(1400).usefulLifeYears(4).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-15288-DL").deviceType("Model X Laptop")
                        .specifications("Core i7 · 16GB RAM · 512GB NVMe")
                        .status(AssetStatus.AVAILABLE_IN_POOL).poolCondition(AssetCondition.NEW)
                        .purchaseDate(LocalDate.now().minusDays(10)).warrantyExpiry(LocalDate.now().plusDays(750))
                        .originalValue(1400).usefulLifeYears(4).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-52290-MB").deviceType("SQUARE Mobile Unit")
                        .specifications("5G · 256GB storage (repaired unit)")
                        .status(AssetStatus.AVAILABLE_IN_POOL).poolCondition(AssetCondition.REPAIRED)
                        .purchaseDate(LocalDate.now().minusDays(500)).warrantyExpiry(LocalDate.now().plusDays(80))
                        .originalValue(700).usefulLifeYears(3).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-60871-DT").deviceType("Standard Desktop")
                        .specifications("Ryzen 5 · 16GB RAM · 256GB SSD")
                        .status(AssetStatus.AVAILABLE_IN_POOL).poolCondition(AssetCondition.OLD_FUNCTIONAL)
                        .purchaseDate(LocalDate.now().minusDays(1100)).warrantyExpiry(LocalDate.now().minusDays(200))
                        .originalValue(800).usefulLifeYears(5).build());

                // Second loaner currently deployed
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-70044-DL").deviceType("Model X Laptop")
                        .specifications("Core i5 · 8GB RAM · 256GB NVMe")
                        .status(AssetStatus.ALLOCATED_IN_USE)
                        .purchaseDate(LocalDate.now().minusDays(1000)).warrantyExpiry(LocalDate.now().minusDays(80))
                        .originalValue(1100).usefulLifeYears(4).userId(sabrinaId)
                        .isLoaner(true).loanerIssuedAt(LocalDate.now().minusDays(3)).build());

                // Devices currently out for repair — feeds the tech Repair log
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-27561-DL").deviceType("Model X Laptop")
                        .specifications("Core i7 · 16GB RAM · 512GB NVMe")
                        .status(AssetStatus.IN_REPAIR)
                        .purchaseDate(LocalDate.now().minusDays(200)).warrantyExpiry(LocalDate.now().plusDays(500))
                        .originalValue(1400).usefulLifeYears(4).userId(raihanId)
                        .repairShop("Original shop (warranty)").sentToRepairAt(LocalDate.now().minusDays(4)).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-38217-MB").deviceType("SQUARE Mobile Unit")
                        .specifications("5G · 128GB storage")
                        .status(AssetStatus.IN_REPAIR)
                        .purchaseDate(LocalDate.now().minusDays(800)).warrantyExpiry(LocalDate.now().minusDays(70))
                        .originalValue(720).usefulLifeYears(3).userId(sabrinaId)
                        .repairShop("Trusted repair shop").sentToRepairAt(LocalDate.now().minusDays(9)).build());

                // More scrap history
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-19022-MB").deviceType("SQUARE Mobile Unit")
                        .specifications("5G · 256GB storage")
                        .status(AssetStatus.SCRAPPED)
                        .purchaseDate(LocalDate.now().minusDays(1300)).warrantyExpiry(LocalDate.now().minusDays(400))
                        .originalValue(760).usefulLifeYears(3)
                        .scrapReason("Water damage — internal corrosion, beyond repair")
                        .scrappedAt(LocalDate.now().minusDays(25)).build());
                assetRepo.save(Asset.builder()
                        .serialNumber("SQ-84410-DT").deviceType("Standard Desktop")
                        .specifications("Ryzen 5 · 16GB RAM · 512GB SSD")
                        .status(AssetStatus.SCRAPPED)
                        .purchaseDate(LocalDate.now().minusDays(1500)).warrantyExpiry(LocalDate.now().minusDays(600))
                        .originalValue(1000).usefulLifeYears(5)
                        .scrapReason("PSU failure caused board damage")
                        .scrappedAt(LocalDate.now().minusDays(60)).build());

                // One device per generated employee, plus extra pool/scrap stock below
                String[] genTypes = { "Model X Laptop", "Standard Desktop", "SQUARE Mobile Unit" };
                String[] genSpecs = { "Core i7 · 16GB RAM · 512GB NVMe", "Ryzen 5 · 16GB RAM · 512GB SSD", "5G · 256GB storage" };
                double[] genValues = { 1400, 950, 760 };
                List<Long> genIds = new ArrayList<>();
                for (String first : GEN_FIRST) {
                    userRepo.findByUsername(first.toLowerCase()).map(User::getId).ifPresent(genIds::add);
                }
                for (int i = 0; i < genIds.size(); i++) {
                    int type = i % genTypes.length;
                    int ageDays = 60 + i * 90;
                    assetRepo.save(Asset.builder()
                            .serialNumber(String.format("SQ-%05d-GN", 40000 + i * 137))
                            .deviceType(genTypes[type]).specifications(genSpecs[type])
                            .status(AssetStatus.ALLOCATED_IN_USE)
                            .purchaseDate(LocalDate.now().minusDays(ageDays))
                            .warrantyExpiry(LocalDate.now().plusDays(730 - ageDays))
                            .originalValue(genValues[type]).usefulLifeYears(type == 2 ? 3 : 4)
                            .userId(genIds.get(i)).build());
                }
                // Nobody works without a device — Superuser, IT Team, admin and leadership included
                String[] staff = { "manager1", "tech1", "admin1", "tech2", "tech3", "tech4", "anisur", "tapan" };
                for (int i = 0; i < staff.length; i++) {
                    Long uid = userRepo.findByUsername(staff[i]).map(User::getId).orElse(null);
                    if (uid == null) continue;
                    int type = i % genTypes.length;
                    assetRepo.save(Asset.builder()
                            .serialNumber(String.format("SQ-%05d-ST", 60000 + i * 173))
                            .deviceType(genTypes[type]).specifications(genSpecs[type])
                            .status(AssetStatus.ALLOCATED_IN_USE)
                            .purchaseDate(LocalDate.now().minusDays(230 + i * 40))
                            .warrantyExpiry(LocalDate.now().plusDays(500 - i * 30))
                            .originalValue(genValues[type]).usefulLifeYears(type == 2 ? 3 : 4)
                            .userId(uid).build());
                }

                // ...and one device for each department-ladder filler employee
                int fi = 0;
                for (String first : FILL_FIRST) {
                    Long uid = userRepo.findByUsername(first.toLowerCase()).map(User::getId).orElse(null);
                    if (uid == null) { fi++; continue; }
                    int type = fi % genTypes.length;
                    assetRepo.save(Asset.builder()
                            .serialNumber(String.format("SQ-%05d-FL", 70000 + fi * 131))
                            .deviceType(genTypes[type]).specifications(genSpecs[type])
                            .status(AssetStatus.ALLOCATED_IN_USE)
                            .purchaseDate(LocalDate.now().minusDays(120 + fi * 17))
                            .warrantyExpiry(LocalDate.now().plusDays(600 - fi * 10))
                            .originalValue(genValues[type]).usefulLifeYears(type == 2 ? 3 : 4)
                            .userId(uid).build());
                    fi++;
                }

                // Extra inventory (NEW) + loaner-pool stock
                for (int i = 0; i < 6; i++) {
                    AssetCondition cond = i < 3 ? AssetCondition.NEW : i < 5 ? AssetCondition.REPAIRED : AssetCondition.OLD_FUNCTIONAL;
                    int type = i % genTypes.length;
                    assetRepo.save(Asset.builder()
                            .serialNumber(String.format("SQ-%05d-PL", 50000 + i * 211))
                            .deviceType(genTypes[type]).specifications(genSpecs[type])
                            .status(AssetStatus.AVAILABLE_IN_POOL).poolCondition(cond)
                            .purchaseDate(LocalDate.now().minusDays(cond == AssetCondition.NEW ? 15 + i * 5 : 500 + i * 60))
                            .warrantyExpiry(LocalDate.now().plusDays(cond == AssetCondition.NEW ? 720 : 60))
                            .originalValue(genValues[type]).usefulLifeYears(4).build());
                }

                // Demo data only — spread unassigned pool devices across the 3 storage
                // bays instead of leaving "Stored at" blank.
                List<Asset> unassignedPool = assetRepo.findByStatus(AssetStatus.AVAILABLE_IN_POOL);
                for (int i = 0; i < unassignedPool.size(); i++) {
                    Asset a = unassignedPool.get(i);
                    a.setStorageLocation(STOCK_STORAGE_LOCATIONS[i % STOCK_STORAGE_LOCATIONS.length]);
                }
                assetRepo.saveAll(unassignedPool);

                System.out.println("Seeded asset pool into PostgreSQL (" + assetRepo.count() + " assets).");
                // Printed once, when an empty database is seeded. The password is
                // never written in source, so this is how you learn it.
                System.out.println("====================================================");
                System.out.println(" Demo accounts created. Sign in with this password:");
                System.out.println("     " + demoPassword);
                System.out.println(" Accounts: admin1 (System admin), manager1 (Superuser),");
                System.out.println("           tech1 (IT Team), saif / raihan (Users)");
                System.out.println(" Set DEMO_PASSWORD to choose your own next time.");
                System.out.println("====================================================");
            }
        };
    }

    /**
     * Production bootstrap — deliberately minimal.
     *
     * Creates the office/department lists the dropdowns need, and nothing else
     * unless the database has no users at all. In that case it creates ONE
     * System admin from the ADMIN_USERNAME / ADMIN_PASSWORD environment
     * variables so there is a way to sign in and onboard real staff. No demo
     * employees, tickets or assets are ever created here.
     */
    @Bean
    @Profile("prod")
    CommandLineRunner initProductionEnvironment(UserRepository userRepo, LocationRepository locationRepo,
                                                DepartmentRepository departmentRepo,
                                                @Value("${ADMIN_USERNAME:}") String adminUsername,
                                                @Value("${ADMIN_PASSWORD:}") String adminPassword) {
        return args -> {
            if (departmentRepo.count() == 0) {
                for (String d : DEPARTMENTS) departmentRepo.save(Department.builder().name(d).build());
            }
            if (locationRepo.count() == 0) {
                locationRepo.save(Location.builder().name("Anita Center (HQ)").floors(11).build());
                locationRepo.save(Location.builder().name("Sector 3 Office").floors(6).build());
                locationRepo.save(Location.builder().name("CSQ").floors(6).build());
                locationRepo.save(Location.builder().name("Bay Tower").floors(6).build());
            }

            if (userRepo.count() > 0) return;   // already provisioned — never touch existing accounts

            if (adminUsername.isBlank() || adminPassword.isBlank()) {
                throw new IllegalStateException(
                        "No users exist and ADMIN_USERNAME / ADMIN_PASSWORD are not set. "
                        + "Set both so the first System admin account can be created, then restart.");
            }
            if (adminPassword.length() < 12) {
                throw new IllegalStateException("ADMIN_PASSWORD must be at least 12 characters long.");
            }

            User admin = new User(adminUsername, encoder.encode(adminPassword), "SYSTEM_ADMIN");
            admin.setName("System Administrator");
            admin.setEmail(adminUsername);
            admin.setDepartment("HR and Admin");
            admin.setJobTitle("Senior Manager");
            admin.setJoinedAt(LocalDate.now());
            userRepo.save(admin);
            System.out.println("Created the initial System admin account: " + adminUsername);
        };
    }

    // Passwords are stored as BCrypt hashes, never in plain text.
    @Autowired
    private PasswordEncoder encoder;

    private User withProfile(User user, String name, String jobTitle, String managerUsername, int daysWorking, String department) {
        user.setPassword(encoder.encode(user.getPassword()));
        user.setName(name);
        user.setJobTitle(jobTitle);
        user.setManagerUsername(managerUsername);
        user.setDepartment(department);
        user.setEmail(user.getUsername() + "@squaregroup.com");
        // Deterministic demo phone number derived from the username
        int n = Math.abs(user.getUsername().hashCode()) % 9000000 + 1000000;
        user.setPhone("+88017" + String.format("%08d", n));
        user.setJoinedAt(LocalDate.now().minusDays(daysWorking));
        return user;
    }

    // Backdates createdAt/resolvedAt so the audit log and activity feed reflect a
    // realistic ticket history instead of everything being timestamped "just now".
    private void createMockTicket(TicketRepository repo, String raisedByUsername, String location, int floor, String department, String problemType, String customDescription, String status, String acceptedBy, int createdDaysAgo, Integer resolvedDaysAgo) {
        Ticket t = new Ticket();
        t.setRaisedByUsername(raisedByUsername);
        t.setLocation(location);
        t.setFloor(floor);
        t.setDepartment(department);
        t.setProblemType(problemType);
        t.setDescription(customDescription != null ? customDescription : problemType);
        t.setStatus(status);
        t.setAcceptedBy(acceptedBy);
        t.setCreatedAt(LocalDateTime.now().minusDays(createdDaysAgo));
        if (resolvedDaysAgo != null) {
            t.setResolvedAt(LocalDateTime.now().minusDays(resolvedDaysAgo));
        }
        repo.save(t);
    }
}
