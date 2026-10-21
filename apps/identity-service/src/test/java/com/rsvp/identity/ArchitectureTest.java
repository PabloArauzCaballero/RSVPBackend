package com.rsvp.identity;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/** REQ-07-01: the domain and application layers stay framework-free. */
@AnalyzeClasses(packages = "com.rsvp.identity", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {
    private static final String[] FRAMEWORKS = { "org.springframework..", "jakarta.persistence..", "jakarta.servlet..", "org.hibernate..", "io.lettuce.." };

    @ArchTest
    static final ArchRule domainIsFrameworkFree = noClasses().that().resideInAPackage("..identity.domain..")
        .should().dependOnClassesThat().resideInAnyPackage(FRAMEWORKS);

    @ArchTest
    static final ArchRule applicationIsFrameworkFree = noClasses().that().resideInAPackage("..identity.application..")
        .should().dependOnClassesThat().resideInAnyPackage(FRAMEWORKS);

    @ArchTest
    static final ArchRule domainDoesNotSeeOuterLayers = noClasses().that().resideInAPackage("..identity.domain..")
        .should().dependOnClassesThat().resideInAnyPackage("..identity.application..", "..identity.infrastructure..", "..identity.interfaces..");

    @ArchTest
    static final ArchRule applicationDoesNotSeeAdapters = noClasses().that().resideInAPackage("..identity.application..")
        .should().dependOnClassesThat().resideInAnyPackage("..identity.infrastructure..", "..identity.interfaces..");
}
